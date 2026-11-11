# Source verification, scoped review acceptance, and retained history

## CURRENT — verified subsets and scoped source acceptance, operations unqualified

Status: `SOURCE_RECONSTRUCTED` / `VERIFIED_TEST_SUBSETS` / `SOURCE_REVIEWS_ACCEPTED_SCOPED` / OPERATIONAL QUALIFICATION OPEN / `trainingReady:false`.

[recovery.md](recovery.md) separates recovered goals from lost evidence.
[gpu-owner.md](gpu-owner.md) and [gpu-cooperative-policy.md](gpu-cooperative-policy.md) describe reconstructed source, verified subsets, and scoped source-review acceptance, not operational acceptance.
The inspected recovery baseline lacked GPU-owner/cooperative-policy source; reconstructed source and repository-owned receipts now exist.
The corrected owner retains 72 cases, locked/offline Clippy `-D warnings`, and direct rustfmt checks for its recorded owner manifest; the authenticated reference guard retains 25/194, and current Rust/TypeScript/backend/adversarial source reviews are accepted within their explicit scopes.
This documentation pass runs no tests, builds, diagram render, or source reviews.
The fresh-evidence subsection below records only the bounded slices directly supported by the new receipts.
All older result counts, temporary receipt paths, retained-log statements, and review acceptances in the historical baseline sections describe historical reports only.
Those older external receipts are unavailable after the reported loss; do not count their assertions as fresh verification or promise the bytes still exist.
The recalled 165 Rust owner / 39 CPU / 585 Bun tests across 72 files with 30,444 assertions are also historical-only.
The final recalled adversarial `401 FAIL` was not accepted; historical security corrections do not override it.
Fresh verification must bind reconstructed source to new bounded repository-owned receipts and new source reviews.
Keep scripts, fixtures, manifests, and bounded `.stdout`/`.stderr` records inside the repository and tracked; do not put caches or compiler outputs in Git.
No historical acquisition/publication grant is renewed.
Selected development restoration is `TOOLCHAIN_OWNER_DEFAULT_CPU_RESTORED` / `LOCKED_INPUTS_RESTORED_AND_FRESHLY_VERIFIED`; all actual host/GPU/image/production/capture/training/publication gates remain denied.

## Fresh repository-owned recovery evidence

All run paths below are relative to `_work/gpu-owner-recovery/runs/`.
These are recorded snapshot results, not a final unified run or a new review verdict.

### Preferred corrected-source receipts

Every receipt below reports `PASS`, exit 0, and `sourceChanged:false`; each retained manifest/stream digest binds that selected snapshot.

| Run | Fresh observation | Proof limit |
|---|---|---|
| `corrected-source-owner-final-2` | 72 top-level Rust cases: 3 JSON units, 13 adapters, 2 CLI, 1 conformance, 8 contracts, 15 lifecycle, 19 observation, 11 wire | Exactly 33 traces and 61 contradiction mutations remain nested inside single cases; no actual Docker/GPU/native policy process |
| `corrected-source-clippy-final-2`, `corrected-source-format-final-2` | Owner all-targets locked/offline Clippy `-D warnings` and direct Rust 1.95 rustfmt `--check` pass | Same manifest as the 72-case suite, not source-review acceptance |
| `corrected-source-cpu-final-1` | 39 default-CPU tests; all 4,670 finite-difference coordinates; default Flex F64 unit passes | Fresh 45-input selected CPU manifest; no CUDA or complete workspace qualification |
| `custody-policy-final-1` | 352 tests / 1,262 assertions | Pure policy and 33 semantic traces; native JS Proxy tests remain separate |
| `custody-bridge-final-1` | 27 tests / 388 assertions | Includes exact `-0` descriptor commitments and explicit Rust/Bun integer-spelling differences |
| `authenticated-git-objects-1` | 25 guards / 194 assertions, zero failures; one C14 test filtered out | Raw commit/tree authentication, no-fetch local-canary, parser/cache/graph-bound cases, and retained guards; no full C14/native proof or review acceptance |
| `exact-selection-runner-final-1` | 12 tests / 72 assertions | Exact file selection, manifest membership, supervisor custody, and the actual replacement-ref audit counterfactual |
| `custody-source-types-final-1`, `custody-test-types-final-1` | Source and test TypeScript checks pass | Recorded source snapshots, not a review verdict |
| `authenticated-git-objects-types-1` | Affected test TypeScript check passes | Same recorded source-manifest digest as the 25-guard run; no source change during verification |
| `exact-selection-tool-types-final-1` | Tooling TypeScript check passes | Same manifest as the 12-test runner/audit suite |
| `security-rust-baseline-packet-3`, `security-typescript-baseline-packet-5` | Bounded original-baseline diff packets and source/stream manifests retained | Accepted source-review inputs; TypeScript packet 5 contains the full 18-file baseline diff, while acceptance lives in the separate review records |

The owner suite includes 19 observation cases, not the intermediate 17: direct/nested leaf renames, ancestor replacement/missing/symlink, repeated-bind FD custody, and honest removal are covered.
The held-leaf unlink predicate proves namespace removal under stable custody, not inode destruction or qualified cgroupfs link-count behavior.
Rust exact numeric `-0` decoding leaves original hashes unchanged; fractional/exponent integer tokens still reject in Rust while existing Bun `z.int` accepts mathematical integral spellings.
These selected passes establish neither global lexical JSON parity nor full legacy Bun, C14/native, actual storage/runtime/GPU/driver coexistence, Gate0/F9/R4, or training qualification.

### Current scoped source review acceptance

`review-corrections.json` and `recovery.json` now record `REVIEWED_SOURCE_ACCEPTED_OPERATIONAL_QUALIFICATION_OPEN`; `SOURCE_REVIEWS_ACCEPTED_SCOPED` is the diagram/status shorthand for that source-only result.
The ledger retains the original findings and corrections, sets `allListedSourceFindingsCleared:true`, and marks filter execution, object ancestry, and lazy-object-fetch `CLEARED_CURRENT_PACKET_5`.
`_work/gpu-owner-recovery/security-rust-review.json` persists session `ses_e462ed1aeffefugdBMBe16ejE1`, `READY_TO_MERGE_RUST_SOURCE_SECURITY_GATE_ONLY`, zero remaining in-scope findings, and the current 72-case/Clippy/fmt `corrected-source-*-final-2` evidence.
The verdict clears all three original Rust security findings and reviewed Rust adversarial/numeric corrections under C1, not the final adversarial gate.
It excludes actual GPU/runtime/filesystems, proc permissions, cgroupfs link-count behavior, atomic Docker binds, and hostile aliases; the read-only reviewer executed no commands, and this pass executes no review.
After the earlier 10-of-11 checkpoint, the parent reported adversarial acceptance of the no-filter 16/108 snapshot; the later object-ancestry finding reopened that gate and is now cleared by current packet-5 reviews.

All review-record paths below are beneath `_work/gpu-owner-recovery/`; each reviewer was read-only and executed no commands.

| Persisted record | Current scoped verdict | Boundary |
|---|---|---|
| `security-rust-review.json` | `READY_TO_MERGE_RUST_SOURCE_SECURITY_GATE_ONLY`, zero remaining in-scope findings | Corrected isolated Rust owner under C1; 72-case/Clippy/fmt evidence and Rust packet 3 |
| `security-typescript-authenticated-review.json` | `READY_TO_MERGE_STABLE_TYPESCRIPT_SOURCE_SECURITY_GATE_PACKET_5`, zero remaining concrete in-scope findings | Full 18-file TypeScript packet-5 diff, including authenticated reference and GPU boundaries |
| `backend-integer-review.json` | `READY_TO_PROCEED_SCOPED_RUST_INTEGER_CONTRACT_ONLY`, zero accepted-contract counterexamples | Exact numeric `-0`, ranges/presence/raw schedule and byte commitments; not global lexical JSON parity |
| `adversarial-final-review.json` | `READY_TO_MERGE_REVIEWED_SOURCE_ONLY_PACKET_5`, zero remaining in-scope findings | Session `ses_e4633f9c4ffem033a7XZ2viOY1`; Rust/TypeScript/CUDA-leaf/recovery-tooling source-only scope, object ancestry/lazy fetching cleared and prior clearances stand |

These current verdicts accept reviewed source only, not full legacy Bun/C14, actual GPU F64/C12, filesystem/fsync/storage, driver/coexistence, proc/cgroupfs qualification, stronger SHA-1 collision resistance, atomic snapshots/binds, operations, training, publication, or Git commit/push authority.
The authenticated guard and affected-typecheck receipts report `PASS`, exit 0, and `sourceChanged:false`, share source-manifest digest `f359081260b2dff474417f658e72f720f541a1f3dcf8e89ed364fa7cd1220dd7`, and retain their stream digests.
Packet 5 separately retains `command.stdout`, `sources.json`, and its passing source-bound receipt; its 18 diff headers are not its source-manifest input count or an acceptance.
`security-typescript-review.json.currentApplicability` marks the old READY verdict `HISTORICAL_SCOPE_PRE_PHYSICAL_REFERENCE_PIN_AND_INTEGER_REGRESSIONS`.
The current contracts and rationale are in [gpu-owner.md](gpu-owner.md) and [recovery.md](recovery.md#physical-reference-baseline-audit-and-manifest-custody).
`source-accepted-diagrams-2` verifies all three final source-acceptance diagrams offline; prior SVG receipts still certify their own earlier bytes only.

### Closing validation — selected reruns and final audits

`_work/gpu-owner-recovery/closure.json` is the source-only machine index for current review records, selected closing runs, proof limits, frozen-boundary audit, final diagram render, and staged hygiene checks.
All twelve closing receipts below report PASS, exit 0, `sourceChanged:false`, `actualHostExecuted:false`, `cudaGpuCodeExecuted:false`, and `trainingReady:false`.
Their command streams retain the actual counts below; these are new closure generations, not rewritten older receipts or a full legacy-suite result.

| Closing run | Fresh recorded result |
|---|---|
| `closure-owner-1` | 72 top-level Rust cases: 3 JSON + 13 adapters + 2 CLI + 1 conformance + 8 contracts + 15 lifecycle + 19 observation + 11 wire; nested 33 traces/61 mutations add no cases |
| `closure-cpu-1` | 39 default-CPU cases, both 2,335-coordinate sweeps / all 4,670 coordinates, and the default Flex F64 selector unit |
| `closure-policy-1` | 352 tests / 1,262 assertions |
| `closure-bridge-1` | 27 tests / 388 assertions |
| `closure-reference-1` | 25 tests / 194 assertions, zero failures, one full C14 test filtered out |
| `closure-runner-1` | 12 tests / 72 assertions |
| `closure-source-types-1`, `closure-test-types-1`, `closure-tool-types-1` | Source, test, and recovery-tool TypeScript checks pass |
| `closure-owner-clippy-1`, `closure-cpu-clippy-1` | Owner and selected default-CPU all-targets Clippy pass locked/offline with `-D warnings` |
| `closure-owner-format-1` | Direct owner Rust 1.95 rustfmt `--check` passes without rewriting source |

#### Completed integrity checks and preserved first failure

`runs/closure-verification-integrity-2/{receipt.json,command.stdout}` records PASS for all twelve closure receipts, manifest SHA-256/counts, raw-stream SHA-256/lengths, and observed test/assertion totals.
It compares the ENTIRE selected current manifest for each closing run: 131 owner/static inputs, 45 CPU inputs, 197 TypeScript/policy/bridge/reference inputs, or 16 runner/tool inputs as recorded for that run; none of those closing comparisons skips entries.
It also compares all 198 current inputs of TypeScript packet 5 and validates that packet's manifest and raw streams.

Preserve `closure-verification-integrity-1` as FAIL, exit 1, with `CURRENT_SOURCE_MISMATCH:security-rust-baseline-packet-3:packages/runtime/tests/reference-bundles.test.ts` in stderr.
That intentionally strict first audit attempted current-byte comparison of the entire historical Rust packet's 225-input inventory, which also contains a superseded TypeScript guard outside the accepted Rust review scope.
The second audit authenticates that historical packet's retained manifest/streams but compares current bytes only for 27 total inputs in accepted Rust scope: recorded `crates/gpu-owner/**` files and root `Cargo.toml`/`Cargo.lock`.
All 27 match.
This is an explicit review-scope provenance correction, not a claim that all 225 historical inputs are current or a waiver for changed Rust source.
Both audit receipts retain their exact inline-script argv; no new source tool or script file is implied, and the first failure remains unchanged.

`_work/gpu-owner-recovery/closure-lock-and-frozen-boundaries.json` completes the current exact workspace/lock audit: owner-only root membership, approved owner/FFT/four-list delta, unchanged existing versions/checksums and other package blocks, and enumerated frozen-source identities including required `policy-initialize.rs`, F9, metadata, native job, and existing validators.
This audit proves its listed boundaries, not whole-repository or operational qualification.

Every receipt still owns its selected snapshot, source-manifest digest, and stream hashes, not one global all-files hash shared by earlier and later runs.
The current closing manifests account for their selected tooling generation, including the third-diagram tooling addition where selected; differing older manifests remain distinct evidence generations.
The integrity checks claim no atomic filesystem snapshot, and scoped source acceptance does not turn synthetic tests into actual GPU/runtime qualification.
Reference verification selected only `reference source guard`, so the full C14 bundle test stayed filtered and no actual native/runtime proof ran.
Full legacy Bun remains unrun because hardcoded external temporary roots, missing reference/runtime inputs, and native prerequisites prevent a valid complete-suite result; closing subsets do not erase those limits.

| Final or prior closing item | Current evidence status |
|---|---|
| `closing-three-diagram-render-1` | PASS, exit 0, three valid SVGs, offline `SANDBOX`, `sourceChanged:false`; hashes cover the prior pending-label diagram bytes only |
| `source-accepted-diagrams-1` | PASS for the first acceptance-label generation; its sources still contained render-pending annotations and are superseded |
| `source-accepted-diagrams-2` | PASS, exit 0, three valid SVGs, offline `SANDBOX`, `sourceChanged:false`; source/output hashes bind the final diagrams without self-referential pending annotations |
| Scoped staged whitespace / tracked namespace check | `closure-git-hygiene-1` PASS: scoped staged check exits 0, generated namespaces are untracked, and all 284 raw streams staged before this receipt was added match physical bytes; unfiltered check retains expected exit 2 on raw captures only |

### Raw evidence and scoped whitespace checking

Keep captured stdout/stderr bytes unchanged, including intentional trailing whitespace bound by receipt hashes; never trim or normalize them to satisfy a text check.
The scoped `git diff --cached --check` excludes only `_work/gpu-owner-recovery/runs/**/*.stdout` and `_work/gpu-owner-recovery/runs/**/*.stderr`; `closure.json` indexes the final captured result after documentation/restaging.
Source, `_spec/`, JSON, and every other staged path remain under strict whitespace checking; no new Git attributes, clean filters, or broad exclusions implement this exception.
This is a scoped staged-repository whitespace check, not a reference-validator Git diff; the validator's no-worktree/cached-diff/no-clean/textconv contract remains unchanged.
The unfiltered whitespace check is a known FAIL on immutable raw captures; preserve that result rather than trimming streams or claiming an unfiltered pass.
The scoped whitespace result proves only its stated staged scope; raw-stream integrity instead comes from the separate completed hash/length audit above.
The hygiene receipt covers the index before adding its own records; its 284-stream comparison is not a self-inclusive or atomic final-index proof.

### Earlier checkpoints — superseded source generations

The following table and checkpoint narratives preserve prior observations; they are not current corrected-source verification or current review acceptance.

| Run / streams | Observed result | Limit |
|---|---|---|
| `no-filter-execution-reference-1`, `no-filter-execution-types-1` | Earlier 16 guards / 108 assertions and test typecheck pass, `sourceChanged:false` | `PRE_OBJECT_GRAPH_AUTHENTICATION`; parent-reported adversarial acceptance covers only that earlier snapshot |
| `security-typescript-baseline-packet-4` | Earlier bounded baseline packet passes, `sourceChanged:false` | Before raw object-graph authentication; packet 5 is the current final-review input |
| `exact-selection-reference-final-1` | 13 guards / 88 assertions; `sourceChanged:false` | `PRE_FILTER_EXECUTION_FIX`; distinct from the later pre-object-authentication 16/108 snapshot |
| `security-typescript-baseline-packet-3` | Bounded source packet retained, `sourceChanged:false` | Before filter-execution correction; later packet 4 also predates object-graph authentication |
| `owner-connected-fixture-correction-1/command.stdout` | All-targets locked/offline owner suite: exactly 38 top-level cases, zero failures, including all 12 connected lifecycle cases; `sourceChanged:false` | CPU/synthetic manager/query/proc/cgroup fixtures only; nested 33 traces and 61 wire mutations are not extra test cases |
| `owner-integrated-clippy-1` | Owner all-targets Clippy passes locked/offline with `-D warnings`; `sourceChanged:false` | Selected source/static snapshot, not Rust security or adversarial acceptance |
| `owner-integrated-format-1` | Direct Rust 1.95 rustfmt, edition 2024, `--check` passes; `sourceChanged:false` | Closed check-only runner mode; no installation or source rewrite |
| `rust-core-check-2`, `owner-closure-isolation-1/command.stdout` | All-targets owner check and dependency tree pass locked/offline, both `sourceChanged:false`; no Burn/application/host-facts/CUDA in the selected owner tree | Verifies selected restored owner inputs and isolation, not a production/runtime closure |
| `security-rust-baseline-packet-1` | Bounded baseline Rust/root Cargo/support packet passes; source/stream digests retained, `sourceChanged:false` | Preparation for review, not an accepted review; 221 manifest inputs are not a test-case count |
| `tooling-frozen-boundary-audit-types-1` | Tooling typecheck passes, `sourceChanged:false` | No inferred fix for the initializer audit-selector gap below |
| `mise-isolation-inspection`, `mise-rust-1950-install`, `mise-zig-cpu-linker`, `rust-1950-identity`, `provisioned-tools-identity` | Scoped minimal-config trust; Rust 1.95.0 minimal/rustfmt/Clippy and Zig 0.15.2 installed; actual compiler identity recorded | Root mise remains untrusted/unchanged; Zig is the restored CPU linker, not a changed CUDA compiler route |
| `cpu-locked-inputs-restored` | Selected locked default-CPU inputs restored; no-run preparation exits 0 with unchanged lock | Owner inputs are separately offline verified by the owner receipts above |
| `cpu-source-manifest-regression-1/command.stdout` | Preferred 39-test CPU pass, including two 2,335-coordinate finite-difference sweeps and default Flex F64 selector unit; `sourceChanged:false` | 43 selected manifest inputs, before/end source checks, stdout/stderr digests; predates the last two runner guards, no final everything-hash or owner/CUDA/full-workspace claim |
| `cpu-offline-clippy-1` | Selected learning + policy-io all-targets Clippy passes locked/offline, `-D warnings`, `sourceChanged:false` | Same recorded 43-input manifest generation as the CPU regression, not owner/full-workspace or later-runner acceptance |
| `cpu-f64-selector-regression/command.stdout` | Earlier 39-test CPU pass retained | Predates source-manifest upgrade; not a complete source-hash snapshot |
| `reference-replacement-ref-regression-1/command.stderr` | Latest 5 reference guards / 34 assertions; `sourceChanged:false` | Adds Git replacement-ref substitution rejection without alternate-code execution; one bundle test is filtered out |
| `tests-reference-replacement-fix-1` | Test TypeScript check passes; `sourceChanged:false` | Same recorded source-manifest digest as the 5-guard run; not final unified verification |
| `reference-canonical-root-corrected/command.stderr` | Earlier 4 tests / 24 assertions; `sourceChanged:false`; includes `assume-unchanged` and `skip-worktree` negatives | `PRE_REPLACEMENT_REF_FIX`; preserve this generation and the failed first canonical-root expectation in `reference-integrity-recovery`; one bundle test was filtered out |
| `fidelity-policy-1/command.stderr` | 352 tests / 2 files / 1,262 assertions; exactly 33 semantic traces; `sourceChanged:false` | Separate Rust owner conformance now passes the same traces within one case; native Proxy tests stay outside JSON traces; no original-byte identity claim |
| `fidelity-policy-source-1`, `fidelity-policy-tests-1` | Both TypeScript checks pass, both `sourceChanged:false` | Correction snapshot, not final unified verification |
| `fidelity-bridge-1/command.stderr` | 24 tests / 3 files / 359 assertions; `sourceChanged:false` | Existing receiver predicates and real SQLite/fixed factory/MatchWorker with fake Bun learners; no actual native learner/GPU or Rust-owner run |
| `fidelity-source-1`, `fidelity-tests-1` | Both TypeScript checks pass, both `sourceChanged:false` | Bridge correction snapshot, not final unified verification |
| `runner-supervisor-loss-fix-1/command.stderr` | Latest harness: 9 tests / 1 file / 28 assertions; `sourceChanged:false` | Covers all three runner HIGH regressions; DevOps permits selected offline checks only |
| `tooling-supervisor-loss-fix-1` | Latest tooling TypeScript check passes, `sourceChanged:false` | Same recorded source-manifest digest as the 9-test run; not final source/review closure |
| `tools-review-packet-types-1` | Later review-packet tooling TypeScript check passes, `sourceChanged:false` | 14 selected tooling manifest inputs; not a new runner-test pass |
| `security-typescript-baseline-packet-1` | Bounded 18-file baseline diff packet passes, `sourceChanged:false`; tracked and untracked changes included | 195 manifest inputs are not 195 reviewed diff files; see scoped security verdict below |
| `runner-group-custody-fix-1`, `tooling-group-custody-fix-1` | Earlier 7-test/20-assertion harness and tooling check pass | Before the last two supervisor guards; not verification of the final 9-test snapshot |
| `runner-provisioning-adapters`, `runner-integrated-recheck-1`, `recovery-tool-manifests-types` | Earlier 6-test/17-assertion harness or tooling typecheck passes retained | `PRE_RUNNER_CUSTODY_FIX`; they do not verify the new command supervisor |
| `offline-reconciled-diagrams-1` | Both prior reconciled diagrams render to valid SVG; offline `SANDBOX`, no includes, `sourceChanged:false`, source/output hashes retained | Earlier diagram bytes; parent must rerender both diagrams changed in this connected-source update |
| `offline-recovery-diagrams-first` | Earlier valid SVGs for both recovery diagrams; source/output hashes retained | Earlier diagram generation only; not substituted for the later reconciled render |

`recovered-lock-delta.json` records exactly the local owner, `cubek-fft 0.3.1` with SHA-256 `48451902f1d21d3eb88cadc17a8a7aeb3b582f17484a68e650f44efe74688b73`, and the four dependency-list additions detailed in [recovery.md](recovery.md#reconstructed-dependency-and-acquisition-history).
All existing versions/checksums and all other package blocks stay unchanged in that audit.
Earlier 276-test policy and 21-test/299-assertion bridge results are `PRE_FIDELITY_CORRECTION`, not verification of the corrected contract.
Full legacy Bun has not rerun because of hardcoded external temporary roots, missing reference inputs, and native prerequisites; do not report a fresh full-suite pass.
The six pre-fix integrated receipts `policy-integrated-recheck-1`, `bridge-integrated-recheck-1`, `source-integrated-recheck-1`, `tests-integrated-recheck-1`, `reference-integrated-recheck-1`, and `runner-integrated-recheck-1` also record passes with `sourceChanged:false`.
Their observed counts are policy 352/1,262, bridge 24/359, reference 4/24, and runner 6/17; the source/test typechecks emit no errors.
They are actual pre-fix code-check observations, not final post-custody verification; parent will rerun the integrated checks.
DevOps found three HIGH runner custody failures; [recovery.md](recovery.md#high-runner-custody-corrections--selected-offline-checks-only) records the live-anchor/kill-before-reap, unexpected-loss-after-zero-exit, and IPC-disconnect cleanup corrections.
`_work/gpu-owner-recovery/devops-runner-review.json` records read-only `READY_TO_CONTINUE_SELECTED_OFFLINE_CHECKS_ONLY` with zero remaining blocking findings in the reviewed runner/provisioning scope; the reviewer executed no commands.
It explicitly grants no adversarial/security/operational acceptance or readiness.
At that checkpoint final integrated checks, reviews, diagram renders, and the initializer audit correction were pending; current scoped acceptance, closing receipts, final render, and corrected audits supersede that checkpoint without rewriting its history.
The 4/24 integrated reference observation is `PRE_REPLACEMENT_REF_FIX`; the newer 5/34 result belongs to a separate source generation.
The old TypeScript verdict below and parent-reported no-filter adversarial acceptance belong to earlier snapshots; the current accepted post-repair packet-5 records above supply distinct scoped source acceptance.
The preferred CPU regression/Clippy receipts bind their recorded source generation, not the last two runner-guard edits; do not promote unchanged Rust sources into a final all-files hash claim.

### Earlier connected Rust owner — PRE_SECURITY_AND_INTEGER_CORRECTION

The public exports `RawLaunchRequest`, `Report`, `run_once`, and `run_once_with` connect the owner modules while ordinary main stays `SOURCE_ONLY_DISABLED`.
`owner-connected-fixture-correction-1` records 10 adapter + 2 CLI + 1 conformance + 6 contract + 12 lifecycle + 7 wire cases = 38 top-level cases, all passing.
This generation is `PRE_SECURITY_AND_INTEGER_CORRECTION`; `security-custody-integration-1` later passed 70 cases before the held-leaf link-count guard's final two rename cases (`PRE_LINK_COUNT_GUARD`).
One conformance case consumes all 33 reconstructed shared traces; one wire case checks 61 contradiction mutations.
Neither nested count adds top-level tests, and this suite does not recover the historical 165-test evidence.
The 12 connected cases include real Rust -> fake Docker -> real Bun GPU-job loop -> SQLite/coordinator/fixed factory/MatchWorker/two fake Bun learners for one attempt; no actual GPU, Docker, or native policy/learning process runs.
Post-SQLite trailing output/nonzero exit remain failed outcomes; storage failure still permits exactly owned cleanup but never removal after wrong image/label, premature partial-write startup fails, and an empty retained cgroup is not disappearance.
The passing fixture correction only creates/removes synthetic `cgroup.threads` and collapses a fixture `if`; it does not relax C2/C8/C13 or any resource/observation contract.
Retain `rust-core-test-1` with its six lifecycle failures and `rust-core-clippy-2` with its preserved-fixture `collapsible_if` failure as earlier failed generations.
The owner check/test/static/tree receipts each record `sourceChanged:false` and unchanged root lock; their distinct manifest hashes bind their own generations, not one final all-files snapshot.
`security-rust-baseline-packet-1/{command.stdout,sources.json,receipt.json}` includes c04 baseline tracked/untracked Rust, support, shared inputs, and root Cargo deltas.
Those packet-1 requests are historical; the current Rust/TypeScript/backend/adversarial scoped source acceptance is recorded above.

### Exact workspace/lock and frozen-source audit

`_work/gpu-owner-recovery/integrated-lock-and-frozen-boundaries-1.json` records root workspace `OWNER_MEMBERSHIP_ONLY`, exactly the local owner/FFT/four-list lock delta, unchanged existing versions/checksums, and unchanged other package blocks.
Its enumerated frozen sources match baseline bytes with retained hashes: tracked F9/Docker/metadata files under `tooling/runtime`, `crates/host-facts`, existing native `job.ts`, state/episode schemas, root `package.json`, and `bun.lock`.
The bounded audit uses global `--no-replace-objects` and a private environment, not actual host/runtime observations.
That earlier audit omitted the actual initializer through the wrong `policy-init.rs` selector; keep it as historically incomplete.
`_work/gpu-owner-recovery/corrected-initializer-frozen-audit-1.json` now includes required `crates/policy-io/src/bin/policy-initialize.rs`, baseline byte equality, and SHA-256 `1024cb2f47bcb5cf494be6da0016ca583342346544a3eb20ca52bf19a001fdf2`.
The corrected selector also requires initializer presence instead of silently accepting an unmatched path; the exact workspace/approved lock and other listed frozen files remain unchanged.
The 12-test runner suite includes a private sparse-clone counterfactual: a checksum substitution plus baseline replacement ref makes the lax audit copy accept, while the current original-object audit rejects, without changing actual workspace refs.

The verification runner's ordinary manifests now include executed `command-supervisor.ts` and pinned `tooling/reference-entrypoints.json`; mode-membership regression covers both.
Current Bun selectors use exact `./` file paths; policy/bridge custody receipts retain actual pre-selector argv, while exact-selection reference/runner receipts verify the later discovery correction.
Preserve `custody-reference-final-1` as FAIL despite 13 guard passes: path-filter discovery loaded an audit clone and hit missing Zod.
Preserve `reference-physical-pin-1` and `reference-physical-pin-types-1` as `SOURCE_CHANGED_DURING_VERIFICATION` failures despite exit 0; `reference-physical-pin-integrated-1` is a separate later pass, not a rewritten failure.

### No-filter reference-validator contract

Compare `git ls-files --stage -z` as an exact mode/OID/path stage-0 set against the original pinned tree's non-tree entries; reject missing, extra, duplicate, unmerged, and mismatched entries.
Retain canonical top-level/SHA-1/no-replace/H-flag checks, raw physical original-tree blob SHA-1 and executable mode, directory/symlink/submodule checks, and every consumed bundle input's original-tree membership/size/SHA-256 before imports.
The validator invokes neither worktree nor cached Git diff and executes no source clean/textconv pipeline; identical physical bytes do not make Git diff safe against untrusted local filter configuration.
The owned regression intentionally runs the old vulnerable diff with a Bun marker/echo filter after an mtime change and proves execution despite unchanged tracked bytes.
It removes the marker, changes mtime again, and proves the corrected guard passes without recreating it; staged-change/physical-restore and extra-index-entry negatives also pass.
The no-filter receipts record 16 guards / 108 assertions and passing test types with `sourceChanged:false` as `PRE_OBJECT_GRAPH_AUTHENTICATION`; one C14 test remains filtered, and the prior 13/88 pass stays `PRE_FILTER_EXECUTION_FIX`.

### Authenticated object-graph source evidence

[reference-bundles.md](reference-bundles.md#authenticate-before-interpreting) and [reference/object-graph-authentication.puml](reference/object-graph-authentication.puml) now document the implemented architect-approved repair in `packages/runtime/tests/reference-bundles.test.ts`, the only source file changed by this delta.
The raw commit command returns body bytes, which hash against the independent pin before parsing the first strict root-tree header; breadth-first raw tree batches require expected OID/type/size/body/LF framing and Git SHA-1 body authentication before binary parsing.
Inventory derives only from that graph, with strict modes/UTF-8 component names and per-validation node caching that expands every reused parent path.
Exact bounds are 4 MiB for metadata/batch stdin/cumulative tree I/O/aggregate path bytes, 4,096 cached trees, 16,384 instantiated entries, tree depth 32 from root 0, and 4,096 bytes per UTF-8 path.
The 20-second graph deadline starts before commit retrieval; physical blobs have independent 16 MiB/file and 128 MiB aggregate limits, not a whole-validator 20-second guarantee.
Physical blob/mode/no-symlink checks, exact stage-0 index/H flags, every consumed input's membership/size/SHA-256 before imports, and validator no-diff/no-clean/textconv restrictions remain intact.
`GIT_NO_LAZY_FETCH=1` and `GIT_TERMINAL_PROMPT=0` remain mandatory; the fresh local `ext::` Bun-canary test demonstrates old-reader execution while failing and corrected missing-tree refusal without a marker.
Owned clone loose-object commit/tree shadows make ordinary Git return forged content under a genuine HEAD; the new guard rejects body-hash mismatches without touching shared alternate stores.
The actual stderr records 25 tests / 194 assertions, zero failures, and one filtered C14 test; those cases already include the no-fetch, object, parser/framing, reused-path/cache and named graph-bound regressions.
Nested negative vectors add no top-level cases, and this selected suite does not establish exhaustive branch/limit-combination coverage or a fresh full legacy Bun/C14/native run.
The repair preserves the existing SHA-1 pin model and claims neither upgraded collision resistance nor an atomic filesystem snapshot, full C14/native proof, operational authority, or training readiness.

### Stable TypeScript source-security acceptance

HISTORICAL ONLY: this verdict predates physical-reference pinning and integer regressions and accepts no current corrected source.

`_work/gpu-owner-recovery/security-typescript-review.json` records read-only review session `ses_e463cc8a8ffenbLOljn5xc5Jaz`, with no reviewer-executed commands, zero remaining findings, and `READY_TO_MERGE_STABLE_TYPESCRIPT_SOURCE_SECURITY_GATE_ONLY`.
Its baseline is `c04a8da9468f7d443bd27d73a08c0bd7ee0e9d20`; `security-typescript-baseline-packet-1/{command.stdout,sources.json,receipt.json}` binds 18 changed files, including four tracked diffs and fourteen untracked additions.
The packet receipt's 195 source inputs are not its reviewed-diff count.
The addressed MEDIUM CWE-345 replacement-ref bypass is fixed by global `git --no-replace-objects` in the reference guard's Git helper.
The synthetic regression preserves expected HEAD, stages an alternate index/worktree, demonstrates the old cached-HEAD diff returns success through a replacement ref, then verifies the fixed guard rejects it without executing alternate reference code.
The fresh 5-guard/34-assertion and test-typecheck receipts both record `sourceChanged:false`; preserve earlier 4-guard/24-assertion receipts as `PRE_REPLACEMENT_REF_FIX`.
This acceptance excludes Rust security, adversarial acceptance, full legacy-suite acceptance, operational acceptance, and readiness.
The earlier post-reconciliation two-diagram render is separately verified by `offline-reconciled-diagrams-1`; this connected-source update changes both diagrams, so its new bytes need another parent-owned render.

### Earlier runner-only receipt

`_work/gpu-owner-recovery/runs/runner-repository-root/receipt.json` records `PASS`, exit 0, actual Bun `1.4.0`, and unchanged source hashes.
This result is `PRE_RUNNER_CUSTODY_FIX`, not verification of the new command supervisor.
Its `command.stderr` records **6 tests / 1 file / 17 assertions / 0 failures** for `_work/gpu-owner-recovery/verify.test.ts`.
Its manifest has seven files; that count is not a source-test count or the parent's nine reconstructed CUDA leaf files.
This is harness-only evidence, not policy, owner, bridge, default-CPU, full Bun, CUDA compilation, or runtime verification.
The two early runner reconstruction failures remain recorded, including the root error and recovery of its own output back into the repository; see [recovery.md](recovery.md#earlier-runner-only-checkpoint).
This earlier receipt alone establishes none of the later policy/bridge/CPU results above.
Parent reports six ignored actual-GPU fixtures; no GPU test ran and app initialization stays unchanged.
Rust `1.95.0` minimal/rustfmt/Clippy plus selected locked owner/default-CPU dependencies may be restored anonymously through repository-local mise with trust restricted to a new minimal config.
The restored selected toolchain/owner/default-CPU boundary is recorded separately in [recovery.md](recovery.md#scoped-development-inputs--restored-selected-inputs).
Template check: `SKIP` because the local template is absent and the parent reports the historical official URL returned 404; use offline plain PlantUML without includes.

## Goals

- [ml-runtime-architecture.puml](ml-runtime-architecture.puml): separate game, learning, rollout/evaluation and product boundaries.
- [game-core.puml](game-core.puml): retain canonical native moves, fog, economy and terminal semantics without legacy planners.
- [observations.puml](observations.puml): preserve recipient-local observation invariants through standard schemas and serialization.
- [learning.puml](learning.puml): preserve the episodic policy objective through Burn operations and autodiff.
- [policy-io.puml](policy-io.puml): bound and pin numeric inference through standard process I/O.
- [representation.puml](representation.puml): encode recipient facts and ordered actions for a standard nonlinear candidate scorer.
- [native-job.puml](native-job.puml): synthetic resource proof passed; production envelope/admission pending.
- [turn-planning.puml](turn-planning.puml): recipient eligibility and separate authoritative queue mutation.
- [candidate-generation.puml](candidate-generation.puml): newly approved bounded selection without legacy family quotas.
- [resolution-primitives.puml](resolution-primitives.puml): canonical deterministic collision prerequisites before typed causal-event integration.
- [gate-closure.puml](gate-closure.puml): open Gate0/F9/R4 dependencies, explicit profile decision and separately authorized runtime/native proof.
- [initialization.puml](initialization.puml): actual canonical opening and both initial recipient observations; no cold F9 process-proof claim.
- [classical-resolution.puml](classical-resolution.puml): canonical classical attack/movement/path settlement with actual-mutation effects.
- [turn-resolution.puml](turn-resolution.puml): complete canonical B/C/F physics, native actor transfers and causal effects.
- [causal-journal.puml](causal-journal.puml): stable private identities, causal preimages, target-only native consumption and bounded standard journals.
- [recipient-production.puml](recipient-production.puml): continuing local knowledge, explicit economic ownership, atomic BOTH data successors and deterministic source-bound replay.
- [runtime-protocol.puml](runtime-protocol.puml): closed private staged native/reference transactions and owned process lifecycle.
- [policy-runtime.puml](policy-runtime.puml): frozen exact policy reconstruction, sampling and one ACKed admission.
- [learning-runtime.puml](learning-runtime.puml): supported Burn accumulation, declared numerical coverage and record proposals.
- [supervision.puml](supervision.puml): outside original-clock deadline supervision and exact owned-cgroup observation.
- [checkpoint-runtime.puml](checkpoint-runtime.puml): private SQLite completion/checkpoint ownership and abort-all publication.
- [match-runtime.puml](match-runtime.puml): whole-match child barriers, owner stop proofs and redundant native learners.
- [host-entrypoint.puml](host-entrypoint.puml): operator-run host mise metadata, separately granted provisioning and selected shared-GPU host Docker learning.
- [gpu-readiness.puml](gpu-readiness.puml): mandatory actual-target F64 GPU scoring/learning, preserved host driver attachment and unqualified GPU/runtime/VRAM/cleanup gates.
- [gpu-owner.puml](gpu-owner.puml): corrected custody, drain-only cleanup, natural-EOF classification, held-ancestor/leaf namespace-removal proof and raw integer tokens; 72 cases pass, source reviews accepted in scope, operational gates remain open.
- [gpu-cooperative-policy.puml](gpu-cooperative-policy.puml): Rust/Bun telemetry/lease/first-failure policy; shared 33 traces pass, source reviews accepted in scope, no VRAM reservation or operational qualification.
- [reference/object-graph-authentication.puml](reference/object-graph-authentication.puml): raw commit/tree authentication, bounded complete inventory and no-fetch refusal; 25/194 passes, packet-5 source reviews accepted, full C14/native and operational qualification open.

## Recovery verification targets and remaining scope

| Target | Required evidence |
|---|---|
| Pure Rust/Bun policy | `tooling/runtime/gpu-policy.ts`; exact runtime `gpu-policy.test.ts` and `gpu-policy-conformance.test.ts`; 33 semantic traces at `tooling/runtime/fixtures/gpu-policy-traces.json`, no historical byte/hash recovery claim; separate native Proxy/trap-canary tests |
| Rust owner | Safe disabled main, exact manifest/file binding, BOOTTIME/poll ordering, bounded helper groups, ownership-safe evidence-independent cleanup and exact cgroup absence |
| Separate Bun GPU job | Contracts `src/gpu-job.ts` and `tests/gpu-job.test.ts`; runtime `src/gpu-job.ts` exports loop and disabled main together; runtime `gpu-job.test.ts`, `fixed-attempt-gpu-owner.test.ts`, and `tests/fixtures/gpu-owner/**`; EOF-before-work/startup barriers, real SQLite/fixed factory/MatchWorker plus two fake Bun learners; no actual GPU/native binaries |
| Cross-language proposal | Existing state/prefix and exact descriptor-token contracts retained; Bun/Rust subsets and scoped source/integer reviews accepted, without global lexical JSON parity or runtime qualification |
| CPU/CUDA retention | Unchanged CPU Flex seeds 101..105, all 4,670 finite differences with unchanged tolerances, exact C12 digests; optional F64 CUDA without fallback |
| Reference object graph | Retained 25/194 and affected typecheck with accepted packet-5 TypeScript security/adversarial source reviews; full C14/native/runtime qualification remains open |
| Documentation | GPU diagrams plus the implemented reference object-graph concern, exact partial coverage projection, null fingerprints; no claim of reconciled legacy coverage |

Parent/build records actual commands, outcomes, skips, and new review verdicts in repository-owned evidence.
Missing libdevice/CUDA/LLVM bytes remain blockers, not permission to reacquire, install, run production builds, or substitute precision/backends.
The grant permits only the stated toolchain/CPU-linker and selected locked owner/default-CPU inputs, now restored and offline verified; it establishes no CUDA/LLVM/NVIDIA acquisition authority or actual runtime-input restoration.

## Persisted tests

| Test filepath | Purpose |
|---|---|
| `crates/gpu-owner/src/json.rs` · inline unit tests | 3 exact integer-token/negative-zero/list/required-nullable/safe-bound cases |
| `crates/gpu-owner/tests/adapters.rs` | 13 adapter cases, including drain-only cleanup, new fault propagation, and forced-versus-natural EOF |
| `crates/gpu-owner/tests/cli.rs` | 2 fresh CLI cases: bounded help only; operational arguments/environment cannot enable normal main |
| `crates/gpu-owner/tests/conformance.rs` | 1 fresh case consuming all 33 reconstructed shared Rust/Bun policy traces |
| `crates/gpu-owner/tests/contracts.rs` | 8 manifest/hash/JSON/resource/origin cases, including evidence/state separation and exact numeric `-0` |
| `crates/gpu-owner/tests/lifecycle.rs` | 15 connected lifecycle cases, including post-SQL failure, deferred-start cleanup, state substitution, and evidence exposure rejection |
| `crates/gpu-owner/tests/observation.rs` | 19 ancestor/leaf custody and namespace-removal cases, including direct/nested leaf rename and retained-FD behavior |
| `crates/gpu-owner/tests/wire.rs` | 11 closed-wire/state/raw-token cases, including negative-zero schedule pinning; 61 contradiction mutations remain nested inside one case |
| `crates/learning/tests/model.rs` | Bounded 2,271-feature input, zero output head, controlled MLP SGD golden and nonzero native-record round-trip |
| `crates/learning/tests/context.rs` | Candidate preference reverses with state through a standard nonlinear model |
| `crates/learning/tests/initialization.rs` | Seeded hidden initialization reproduces results and receives gradients after the first head update |
| `crates/learning/tests/episode.rs` | Summed policy-gradient objective, baseline scaling, L2, empty episodes and bounds |
| `crates/policy-io/tests/score.rs` | Native-record identity, nonzero scores, F64 JSON, shape/domain rejection and executable success/failure |
| `crates/policy-io/tests/f32.rs` | Reject silent F32 inference |
| `packages/game-core/tests/board.test.ts` | Placement, coordinates, blocked rays, mutual CC attacks, checker order and visibility |
| `packages/game-core/tests/initialization.test.ts` | Exact reference opening, initial geometry, zero endowed paid basis, CC exclusion and detached game state |
| `packages/game-core/tests/economy.test.ts` | Caps, costs, income, turn clocks, stored banks, deployed material and overlay gas |
| `packages/game-core/tests/outcome.test.ts` | CC deaths and turn-cap outcomes |
| `packages/game-core/tests/moves.test.ts` | Marine bands/promotion, siege fire, mine targets and shape-only intents |
| `packages/game-core/tests/mines.test.ts` | Ray contact, exemptions, packing and three-mine cap |
| `packages/game-core/tests/vision.test.ts` | Unit/side fog, dark BattleShip pings, own mine light and path-reveal taps |
| `packages/game-core/tests/canonical.test.ts` | Canonical fingerprints for 1,536 move/fog boards and 49,152 shape queries |
| `packages/game-core/tests/planning.e2e.test.ts` | Public planning-API flow from placement through fog filtering to recipient intents |
| `packages/game-core/tests/native-classical.test.ts` | Heads-first ordering, transfer identity, insertion/result contexts, promotions and native drops |
| `packages/game-core/tests/planning-intents.test.ts` | Known-board shape, vacancy, special anchors, CC crushing exclusions and timing |
| `packages/game-core/tests/queue-action.test.ts` | Pure authoritative append/remove, gas debit/refund, stable sequence IDs and failure nonmutation |
| `packages/game-core/tests/canonical-planning.test.ts` | 49,152 dependency checks and 344,064 append decisions against recorded canonical fingerprints |
| `packages/game-core/tests/canonical-queue.test.ts` | 92,518 authoritative append attempts and 6,502 removals against the canonical fingerprint |
| `packages/game-core/tests/resolution-primitives.test.ts` | Mine ordering/chase, timed collisions/deaths, path taps and Charon screens/fire-and-forget |
| `packages/game-core/tests/canonical-resolution.test.ts` | 554,496 canonical schedule/contact/mine/Charon/ray cases |
| `packages/game-core/tests/collision-primitives.e2e.test.ts` | Mine landing death through travel schedule to later-contact cancellation |
| `packages/game-core/tests/classical-resolution.test.ts` | Common-board attack wave, fogged swaps, timed collisions, CC contacts, landing death, promotions, siege, pending rays and live path operands |
| `packages/game-core/tests/canonical-classical.test.ts` | 122,160 canonical classical-phase cases with full intermediate/result fingerprints |
| `packages/game-core/tests/turn-resolution.test.ts` | B/C/F Marine walks, native doubles, held/chasing mines, F actor anchors, promotions, dead-actor Charon, siege, jumps and terminal chips |
| `packages/game-core/tests/canonical-turn.test.ts` | 11,045 canonical begin/admission/settlement cases, including 1,727 retained rejections |
| `packages/game-core/tests/turn-resolution.e2e.test.ts` | Both canonical seats staged from the same opened board through actual simultaneous B/C/F settlement |
| `packages/game-core/tests/causal-events.test.ts` | Stable identities, immediate birth/loss, ordered mine multiplicity, common preimages, promotion, snapshot/failure guards and separate evaluation/applied operands |
| `packages/game-core/tests/causal-parity.test.ts` | All 11,045 canonical begin/admission/settlement outcomes with and without the journal sink and standard journal round trips |
| `packages/contracts/tests/observation.test.ts` | JSON round-trips, readonly copies, field bounds, visibility/memory, lineage and economic conservation |
| `packages/contracts/tests/initialization.test.ts` | Both actual initial recipients, fogged opening knowledge without fabricated sightings, zero ledgers and producer/root separation |
| `packages/contracts/tests/recipient.e2e.test.ts` | Recipient JSON through validation and serialization to core move generation |
| `packages/contracts/tests/inference.test.ts` | Numeric JSON request/response bounds and identity matching |
| `packages/contracts/tests/causal-journal.test.ts` | Standard state/journal schemas, field/byte bounds and ordering, target, trace, counter, mode and substitution rejection |
| `packages/contracts/tests/recipient-privacy.test.ts` | Actual-kernel hidden-prefix/siege/replacement twins, incidental ships, casualty-memory ordering, nonacting recipients, failed consumption and dead vision sources |
| `packages/contracts/tests/recipient-codec.test.ts` | Public standard batch round trip, private-field exclusion, side isolation and sequence-gap rejection |
| `packages/contracts/tests/game-session.test.ts` | Actual canonical init/open, explicit banks, paid lifecycle/promotion/waste, capped grants, atomic pair failure and replay gap/conflict/idempotence |
| `packages/policy/tests/features.test.ts` | Actual board/resource/action layout, color-relative symmetry, fog/memory separation, bounds and fresh buffers |
| `packages/policy/tests/initialization.e2e.test.ts` | Canonical initialization through both recipient producers, generated candidates, private queue admission and mirrored actual features |
| `packages/policy/tests/source-boundary.test.ts` | Pinned TypeScript first-party closure; runtime/type-only/transitive producer-import negatives, host builtins and dynamic-loader rejection |
| `packages/policy/tests/policy-process.e2e.test.ts` | Validated observation/candidates through actual encoding and native Burn scoring, with checkpoint-hash mismatch rejection |
| `packages/policy/tests/recipient-noninterference.e2e.test.ts` | Actual continuing recipient hidden-state twins through candidate generation, encoding and frozen native Burn scoring with a synthetic checkpoint |
| `packages/policy/tests/queue-planning.e2e.test.ts` | Recipient JSON through eligibility, separate authoritative queue edits and actual feature encoding |
| `packages/policy/tests/candidates.test.ts` | New enumerator bounds, family/depth coverage, resource/mine/dependency constraints and mirrored recipient order |
| `packages/policy/tests/enumeration-golden.test.ts` | New enumeration-version order and capacity/attempt/exhaustion boundaries |
| `crates/learning/tests/accumulation.rs` | C6 accumulated gradients equal the summed episode objective/SGD; frozen baseline, bounds and reload |
| `crates/learning/tests/finite_difference.rs` | C7 active/inactive ReLU fixtures check 4,670 declared coordinates with unchanged tolerances |
| `crates/policy-io/tests/channel.rs` | Closed frozen score/ACK/finish/close protocol, logical F64 digest and emitted-record reload |
| `crates/policy-io/tests/initialize.rs` | C10 master seeds 101..105, exact hidden reproducibility and zero bias-free output head |
| `packages/contracts/tests/native-protocol.test.ts` | Closed native worker phases, binding, replay and post-close rejection |
| `packages/contracts/tests/native-intents.test.ts` | Separate 65 recorded/opponent intents from four learned actions; typed actual side/index rejection |
| `packages/runtime/tests/artifacts.test.ts` | Independent manifest expectation, required roles, bounded bytes, symlinks and substitution negatives |
| `packages/runtime/tests/native-session.test.ts` | BOTH comparison/commit barriers, wrong identity/order, replay/reentry, cleanup and close receipts |
| `packages/runtime/tests/reference.test.ts` | Original source-bound init/open/pass fingerprints and missing-export refusal |
| `packages/runtime/tests/closure.test.ts` | Supported Bun runtime closure excludes current resolver from reference and policy/learning/model-input/storage dispatch from native-only workers/job |
| `packages/runtime/tests/process-transport.test.ts` | Actual owned synthetic process pipes, EOF/reap, byte limits, unsolicited output and nonzero exit |
| `packages/runtime/tests/job.test.ts` | Native-only no-work boot barrier, fixed command, original guard and no retry |
| `packages/runtime/tests/policy-session.test.ts` | Full 512-candidate transaction plus exact permit/action/RNG/distribution/ACK/admission negatives |
| `packages/runtime/tests/rng.test.ts` | Twenty roots, 5,120 frozen reference draws, restore-next-draw and impossible-prefix rejection |
| `packages/runtime/tests/native-learner.e2e.test.ts` | Real fixed Burn child with synthetic ACK/return, diagnostic empty completion and record reload |
| `packages/runtime/tests/learner-pair.test.ts` | Logical proposal/counter/objective comparison, distinct channels, dual abort and concurrent revocation |
| `packages/runtime/tests/learner-pair.e2e.test.ts` | Two actual Burn children compare a synthetic full-F64 proposal and reload digest |
| `packages/runtime/tests/curriculum.test.ts` | Exact 1000-slot A schedule, Fisher–Yates prefixes, alternating seats, no slot 1001 and root/order negatives |
| `packages/runtime/tests/training-store.test.ts` | SQLite STARTED/atomic completion, delayed cadence checkpoint at actual epoch 101, rollback failure and abort-all |
| `packages/runtime/tests/corpus.test.ts` | Trusted audited source bounds, full consumed prefix, empty queues and roster/pin/order negatives |
| `packages/runtime/tests/strategic.test.ts` | Frozen private opponent context, tentative RNG, exact replay/ACK and mutation/spend/deadline negatives |
| `packages/runtime/tests/match-session.test.ts` | Child-owned whole-match ordering, actual native/recorded stop proof, known-prefix cutoff and infrastructure refusal |
| `packages/runtime/tests/match-process.test.ts` | Supported owned process group, natural close/reap, cutoff and retained competing integrity fault |
| `packages/runtime/tests/match-session.e2e.test.ts` | Separate synthetic match child/native scorer/two Burn learners through verified retained-byte SQLite completion, retained initial bytes and post-close scratch release |
| `packages/runtime/tests/private-state.test.ts` | Actual exclusive journal segment bytes, cumulative SHA-256/global ordinals, reservation/exhaustion and no overwrite |
| `packages/runtime/tests/training-coordinator.test.ts` | STARTED before process construction, publication failure, original-clock postcommit abort and reentry revocation |
| `packages/runtime/tests/storage-bounds.test.ts` | Exact fixed-write byte/entry calculation below nominal 200 GB without claiming an allocation or qualified physical fit |
| `packages/runtime/tests/model-inputs.test.ts` | Serial owned scratch release without accumulation; retained failed inputs and refusal to remove unexpected files |
| `packages/runtime/tests/training-artifact.test.ts` | Closed synthetic final metadata, exact five-master roster/primary and no private scheduling/RNG fields |
| `packages/runtime/tests/reference-bundles.test.ts` | Fresh 25 guards / 194 assertions include raw-object/no-fetch/parser/cache/graph-bound and retained guards; prior 16/108 stays `PRE_OBJECT_GRAPH_AUTHENTICATION`, and full C14/native proof stays filtered/unqualified |
| `packages/runtime/tests/host-facts-task.test.ts` | Four prebuilt-handoff tests: literal closed artifact/task expectations, unchanged Python tasks/disabled auto-install, real mise fake-artifact literal-argument forwarding with empty stores, and missing bytes failing without staging/build/install/download |
| `tooling/runtime/tests/test_supervise.py` | Fake manager/cgroup controls, original deadlines, owned cleanup, evidence failure and no operational retry |
| `tooling/runtime/tests/test_evidence.py` | Bounded exclusive fsynced evidence, retained failure reservations and packet-wide storage refusal |
| `tooling/runtime/tests/test_state_mount.py` | C13 exact selected private bind source/target and substituted/extra mount refusal |
| `tooling/runtime/tests/test_recipe.py` | Unexecuted pinned multi-stage recipe, network-disabled builds, nonroot/init and six fixed reference outputs |
| `tooling/runtime/tests/test_host_inventory.py` | C16 bounded CPU/projection calculations and refusal to promote sandbox observations to daemon-host authority |
| `tooling/runtime/tests/test_host_view.py` | C17 bounded mountinfo projection, local/cgroup selection and malformed-input refusal |
| `tooling/runtime/tests/test_host_preflight.py` | V2 bounded/explicitly skipped hashes, six-command contract-help allowlist, retained partial/exception receipts, symlink invocation, task schema guard, actual mise/parser/basic/contract e2e with synthetic tools and failure/byte/deadline cleanup |
| `tooling/runtime/tests/test_host_admission.py` | Sixteen synthetic/static admission cases: fixed CPU/RAM/filesystem projections, no creation/source overlap/symlink substitution, byte/DRM/card bounds, exact non-process NVIDIA query, retained facts on missing Docker, fail-stop/no follow-up, separate fake-Docker CLI e2e and task-schema/profile guards |
| `crates/host-facts/src/socket.rs` · inline unit tests | Four real Unix-listener pin/probe tests: leaf replacement, parent replacement, unlink/replacement and unsafe/absent endpoint refusal; replacement listeners receive nothing |
| `crates/host-facts/src/http.rs` · inline unit tests | Fixed HTTP/EOF/timerfd bounds; test-only fdinfo/simulated expiry; bounded nonblocking BOOTTIME fixture accepts and zero-duration client/server-join regression |
| `crates/host-facts/src/cgroup.rs` · inline unit tests | Eleven cases, including eight new descriptor/statx mount-ID, topology/order/escape, missing-mask/ID/error, directory-replacement and no-follow cases; four content paths only; synthetic cgroup2 rows are not filesystem qualification |
| `crates/host-facts/src/projection.rs` · inline unit tests | Typed Serde fields/types/ranges/duplicates, UTF-8 and lexical depth guard, bounded options/runtime keys, ignored-value grammar validation and secret-canary exclusion |
| `crates/host-facts/src/lib.rs` · inline unit tests | Caller guard, sole endpoint, held cgroup guard and mount-binding failure before RPC; synthetic sequencing/failure retention, false gates and encoded-stdout bound including escaping/newline |
| `crates/host-facts/tests/cli.rs` | Child `--help` and invalid-argument paths only; no host metadata collection |
| `crates/host-facts/tests/recipe.rs` | Exact three-policy-binary build/copy allowlist; reject host-tool copy and workspace-wide native build without changing the Docker recipe |

The persisted process e2e tests use explicitly synthetic source/model/return fixtures.
The whole-match fixture uses actual canonical game transitions and native Burn updates, not a genuine corpus/strategic rollout or a measured training experiment.
The separately authorized historical one-shot Docker proof remains in [native-job.md](native-job.md).
It is not the final production envelope or a current live host e2e qualification.

## Existing results before the Docker runtime metadata slice

- Rust: 38 tests pass with locked, offline dependencies and 2 Cargo jobs.
- Rust formatting: passes.
- Clippy: passes with warnings denied.
- Bun after host-mise/storage refresh: 489 tests pass across 66 files, with 29,887 assertions.
- TypeScript: source and tests pass strict static analysis, including unused-symbol checks.
- Python after the admission/GPU addition and facts-first correction: all 74 fake/synthetic/static tests pass, including 16 admission tests and the retained host-preflight/contract/C16/C17/C19 fixtures.
- PlantUML: all 24 diagrams pass syntax checking and SVG rendering in `/tmp/opencode/chess-coach-ii-gpu-host-facts-final-d9vaickr/`.
- Synthetic Docker: one container passed limit, inheritance, CPU/PID/memory pressure and manager-cleanup checks within 7.477 seconds; no production-admission claim.
- New JSON manifests and whitespace: pass.

Rust verification uses the operator-approved installed Zig 0.15.2 through temporary C-driver scripts outside the repository. A normal GCC/Clang development toolchain remains sufficient on a standard host. No repository compiler shim or runtime bootstrap is required.

The current admission/GPU Python/AST/TOML/whitespace, actual mise parser/discovery and 24-diagram receipt is `/tmp/opencode/chess-coach-ii-gpu-host-facts-final-d9vaickr/`.
It includes the separate fake-Docker CLI e2e and retained synthetic basic/contract task e2e checks.
Its import-only `development-admission-import-inventory.stdout` records the isolated development Python dependency files without calling the metadata entrypoint or querying hardware.
Its current source hashes bind the final facts-first correction and refreshed spec/test indexes.
Its `operator-reported-contract-and-decisions.json` preserves the earlier structured operator report/decisions; it is not an agent host-execution receipt.
The preceding `/tmp/opencode/chess-coach-ii-gpu-host-facts-verification-vw4rtfoq/` passed 73 tests before the final facts-first change and cannot verify that change.
The new profile collects hardware/filesystem metadata before local Docker client discovery, preserving those facts when Docker is absent.
It keeps GPU learning required, GPU qualification absent and `trainingReady:false`.
No actual host admission-facts invocation, GPU computation, provisioning or training occurred in this verification.
Executor subsequently selected `Commit + push (Recommended)` for the 19-file admission/GPU source/spec/test phase and the exact one-shot operator-run facts command.
The post-approval source/verification publication receipt is `/tmp/opencode/chess-coach-ii-gpu-host-facts-publication-pj4qpqli/`.
It preserves the preceding verification receipt without overwriting its source manifest.
Executor subsequently supplied the admission report recorded below; the earlier verification receipt remains unchanged.

## Operator-reported admission evidence

The complete returned JSON message is `/tmp/opencode/chess-coach-operator-host-admission-FenA0l/operator-message.json`.
Its adjacent `provenance.json` labels it `OPERATOR_MESSAGE_NOT_AGENT_HOST_EXECUTION`.
The receipt records a 3,796-byte report with SHA-256 `93a91d87976953e69b3d71521a1469ab5e47673d23c7261ea54431bb8984fad2` in `derived-summary.json`.
That summary derives arithmetic from the message; it is not a second independent observation or host qualification.
The canonical reported inventory and unchanged acceptance boundary are in [host-entrypoint.md](host-entrypoint.md#received-observations-and-provenance-boundary).

The executed source commit, exact operator invocation, execution timestamp and standalone stdout/stderr byte records are unknown (`null`).
The expected handoff command is not evidence of the executed invocation.
Do not retrospectively bind this report to current development commit `875378db96ca80e12a6deaeb5de858ba3ebd3a23` or to any later source snapshot.
The local receipt digest binds the retained message bytes, not independently selected host/tool/runtime identities.
Retain the original message and its provenance without replacing them with the derived summary or silently filling missing fields.

The report keeps `OPERATOR_ASSERTED_HOST_UNQUALIFIED`, runtime admission false, GPU `NOT_QUALIFIED`, provisioning/training authorization false and `trainingReady:false`.
The available-byte/RAM samples reserve nothing; zero btrfs entry counters do not prove exhausted inodes or successful entry admission.
No daemon, runtime/GPU qualification, allocation, provisioning or training evidence follows from this metadata report.

## Rust host-facts v2: implemented source evidence

Status: GNU AND MUSL RUST SOURCE TESTS PASS, 72 EACH / BOTH EARLIER RUST SOURCE REVIEWS ACCEPTED / LOCAL STATIC ASSET AND PREBUILT TASK VERIFIED / LATEST HANDOFF-FILE REVIEWS PENDING / NO APPROVED RUNNABLE HOST HANDOFF OR HOST/PUBLICATION GRANT.
The implemented contract is [host-runtime-inventory-request.md](host-runtime-inventory-request.md); `crates/host-facts`, package `chess-coach-host-facts`, is a separate development/control-plane source boundary.
Executor approved necessary coding-sandbox tooling installation through `mise install`; the lead reports Rust 1.95 installed.
That tooling approval neither grants host installation/execution nor relaxes the prebuilt-only operator entrypoint.

The fresh private receipt is `/tmp/opencode/chess-coach-rust-host-facts-verification-YYp6eH/`.
Its current `rust-tests-mountid.stdout`/`rust-tests-mountid.stderr` record 72 passing Rust tests: 69 library unit tests, one CLI parser integration test and two native-recipe partition tests, with no failures.
The earlier `rust-tests-timerfd.stdout`/`rust-tests-timerfd.stderr` retain the 62-test timerfd checkpoint; `rust-tests.stdout`/`rust-tests.stderr` and `phase-57-pre-review.json` retain the 57-test pre-review phase.
Neither earlier checkpoint is final verification or review acceptance for the latest three source files.
The socket module's four tests include real leaf/parent/unlink replacement checks that deliver only to the original held socket, plus unsafe/absent probe cases.
Its `python-final.stdout`/`python-final.stderr` retain 74 passing restored Python tests in 0.495 seconds before the latest mise tool-option addition; the preceding `python-baseline.*` receipt remains preserved.
That baseline is historical; the new post-mise/task 74-test pass is retained in the separate static/handoff receipt below.
The complete Rust collector ran only against synthetic temporary-root Unix fixtures; executable child tests used `--help` or invalid arguments, never real host collection.

Five new HTTP tests inspect only their own timer fdinfo under `cfg(test)` to confirm clock ID 7, absolute-arm flag 1 and CLOEXEC/NONBLOCK; observe timer-only expiry; simulate expiry with a socket already readable; reject zero/range setup before RPC; and discard a projection completed after expiry.
The simulated expiry test re-arms only its own test timer; production creates/arms once per valid request and performs no fdinfo read or timer read/rearm.
The request origin/end precede timer creation; absolute BOOTTIME timerfd readiness backs every socket wait and defeats the suspend-excluding relative `ppoll` timeout.
Checked setup failures retain fixed initialized receipts without connecting, and timer expiry/error wins over socket progress while clock checks remain before I/O, after poll and after projection.
Expiry is observable when execution resumes; these tests do not show actual suspend, host-clock qualification or exact-deadline socket closure while execution is suspended/unscheduled.
The implementation validates UTF-8 and lexical nesting depth below 128 before standard Serde parsing, including ignored fields/runtime definitions; this is a bounded preflight, not a general JSON parser or bespoke codec.
The cgroup view now pins `/sys/fs/cgroup` and its fixed parents using descriptor-relative no-follow directory opens, requires ordinary statx MNT_ID mask/nonzero identity on the held FD, and selects its unique matching mountinfo row after standard escape/ancestry validation.
The collector retains that guard throughout collection and opens the two controller files relative to the same directory; the mount ID remains internal and `exposesCgroupV2` refers to this pinned observation, not an atomic/global-path or enforcement claim.
The four content-file allowlist entries remain unchanged; only fixed read-only directory metadata/statx calls were added.
Eight new cgroup cases combine real statx and independently obtained fixture-FD IDs with parser-level hidden-overmount/order/escape checks, missing/duplicate/malformed-row refusal, unsupported/missing ID masks and replaced-controller-directory tests.
Their cgroup2-labelled rows are synthetic metadata, not evidence that the fixture filesystem is a real cgroup filesystem.
A new collector negative blocks binding failure before Docker RPC and leaves the view unknown; a new HTTP fixture regression makes a zero-duration client's server join terminate without any connection.
Both formerly blocking HTTP fixture accept sites now use one-second nonblocking BOOTTIME loops; 150 ms client deadlines and 300 ms EOF holds remain test controls, not changes to the production 10-second bound.
The 128 KiB stdout ceiling includes the final newline; encoding overflow emits no report bytes and only fixed `HOST_FACTS_REPORT_BOUND` stderr with exit 1.
All runtime/GPU qualification and provisioning/training authorization/readiness gates remain false.

`host-cargo-tree.stdout` retains the successful offline host-tool dependency inventory; it contains no Burn, learning or policy dependency.
`workspace-metadata.json` retains standard Cargo `--no-deps` metadata; root/member manifests and direct dependency declarations separate the host tool from application direct dependencies.
Workspace load inputs are not the selected build/runtime closure: [gate0-packet.md](gate0-packet.md#input-registration-roles) now includes every root workspace member's required manifest/source, while the unchanged Docker recipe builds/copies only the three policy binaries.
The two persisted recipe tests enforce that exact allowlist and reject host-tool copying or `--workspace` builds.

The application offline Cargo-tree attempt failed because cached `addr2line v0.27.1` was missing; `policy-cargo-tree.stderr` preserves that failure.
No online fallback ran, and this record supplies no complete application Cargo closure, workspace/model Rust rerun, production build or GPU proof.

`bun-partition.stdout`/`bun-partition.stderr` retain 22 passing partition tests, zero failures and 121 assertions across the two selected source-boundary/closure files; this is not a full Bun/TypeScript rerun.
The current supplied `fmt-mountid.stdout`/`fmt-mountid.stderr` and `clippy-mountid.stdout`/`clippy-mountid.stderr` retain passing formatting-all and host-tool Clippy with warnings denied after the mount/fixture changes; the timerfd-phase static receipts remain historical.

The contained Rust security review reported MEDIUM CWE-400 because relative `ppoll` excludes suspend time.
The architect approved the absolute BOOTTIME timerfd backstop, and the lead implemented it with the five new tests.
Security accepted the timerfd/privacy state with `READY TO MERGE: yes` at the earlier 62-test checkpoint.
Adversarial review still identified MEDIUM mount-selection topology and unbounded HTTP fixture-accept findings; the architect approved the pinned ordinary-mount-ID binding and bounded fixture fixes now represented by the 72-test receipt.
The lead subsequently supplied adversarial `READY TO MERGE: yes` for the 72-test mount/fixture corrections and security `READY TO MERGE: yes` for the 72-test source, privacy/timerfd and targeted statx changes.
Both source-review acceptances are true for that reviewed Rust diff only; they grant no host, artifact registration, source publication or distribution operation.
The later mise task, closed artifact metadata and persisted Bun task test passed their development checks and separate targeted adversarial/security reviews, both returning `READY TO MERGE: yes`.
Security retains the independent staging/hash-verification requirement because the task trusts its pathname; neither a digest-named directory nor mode 0555 enforces integrity.
Actual artifact bytes are now locally frozen and the task exists, but no production/host artifact registration, approved actual-host path or approved runnable host handoff follows.
Keep the private Python receipts below historical; they verify neither this Rust source nor its eventual packet.

## Static HTTPS artifact and prebuilt handoff: local preparation verified

Executor selected `Static HTTPS artifact (Recommended)` for preparation only; no GNU loader bundle or actual-host build was selected.
The initial Zig-musl link failed with duplicate `_start` from competing Zig/Rust CRT startup objects; `/tmp/opencode/chess-coach-host-facts-static-1cCOX8/` remains unchanged failed-attempt evidence.
Stable Rust 1.95 rejected the read-only `gnu-lld` linker-flavor probe as unstable; the corrected recipe uses bundled Rust LLD with stable `ld.lld` and Rust-provided self-contained musl CRT.
No nightly, `RUSTC_BOOTSTRAP`, handwritten CRT or application recipe/target/feature change followed.

The successful private receipt is `/tmp/opencode/chess-coach-host-facts-static-lld-6OVK2f/`.
Its private `build-recipe.json`, `build.stdout` and `build.stderr` record the package-only musl release, locked/offline and two jobs, with source/cache remapping and symbol stripping.
Never publish raw recipes or LLVM inspection files containing builder paths.
The frozen local `artifact/host-docker-runtime-facts-linux-x86_64-musl` is 674,400 bytes, mode 0555, SHA-256 `67541b7b2fb0388cd7bfefedfb69fcc74a7cca2e34cdf7f937fea15d2880538a`.
Private `verify-artifact.ts`, `artifact-inspection.json` and `elf-inspection-final.json` bind standard LLVM inspection to those bytes: no interpreter, needed library, RPATH or RUNPATH; five unsafe-ELF negatives rejected; four help/invalid smokes and the private-builder-path scan pass.
Static PIE `ET_DYN` with `PT_DYNAMIC` is allowed; these headers alone do not mean an external loader dependency.
No real `--confirm-host` profile ran, and real-host compatibility, deployment/runtime/GPU qualification and training readiness remain false.

`musl-tests.stdout`/`musl-tests.stderr` retain the actual release-musl 72-test pass: 69 unit, one CLI parser and two native-recipe tests.
The GNU 72-test and earlier Python/source receipts remain separate valid evidence, not a combined workspace/model test count.
`bun-handoff.stdout`/`bun-handoff.stderr` retain 26 passing tests across three files with 137 assertions: 22 partition tests plus the four new persisted handoff cases.
`typecheck.stdout`/`typecheck.stderr` retain the full strict source/test TypeScript check; `python-handoff.stdout`/`python-handoff.stderr` retain 74 passing post-mise/task Python tests in 0.593 seconds.
These do not claim a full Bun suite, full model Rust rerun, host execution or GPU e2e.

The architect accepted the source handoff plan; the new task now invokes the single literal digest-qualified prebuilt path, with raw_args/raw/quiet and no build/install/download/staging/dependencies/env/implicit confirmation.
The new closed `tooling/runtime/host-facts-artifact.json` records actual expectations while keeping deployment/runtime admission/host execution/provisioning/training/readiness false and GPU `NOT_QUALIFIED`.
The real-mise tests use fake bytes and empty tool/Cargo/Rustup stores; metacharacters remain literal arguments, while missing bytes fail without creating a target or falling back.
The actual binary still accepts only an explicit single `--help` or `--confirm-host` argument.
The proposed relative host store is not an accepted actual-host deployment; 0555 and a digest directory name supply neither confidentiality nor strong immutability under writable ancestors.
Independently accepted expected hash/size, approved exclusive HTTPS placement with no overwrite, operator-controlled/private-to-job storage and an exact fresh query grant remain prerequisites; cleanup or `cargo clean` invalidates staging without fallback.

The Rust tool options retain 1.95.0/minimal/rustfmt/Clippy plus installed llvm-tools/musl target; auto-install remains false and the three Python task bodies remain unchanged.
Root mise now also contains the new prebuilt task; it is no longer a tool-options-only diff.
Reviewers are rechecking the latest mise/metadata/test files; do not transfer the earlier Rust-source READY verdicts to that later handoff diff.
There is NO APPROVED RUNNABLE HOST HANDOFF until fresh publication or approved transfer, staging/deployment selection and exact host-invocation approval; preparation and task-plan acceptance grant none of those operations.

## Blocked Docker metadata proposal: Python verification

Status: PYTHON CLI PROPOSAL BLOCKED, SUPERSEDED AND REMOVED / RUST SOURCE-ONLY SUCCESSOR PLAN ACCEPTED / NO REGISTERED OPERATOR PACKET OR NEW HOST/PUBLICATION APPROVAL.
The CLI draft retained in the private receipt is historical; the [current Rust contract](host-runtime-inventory-request.md) replaces it with separate source evidence recorded above.
The Python results below supply no Rust implementation verification.

The private Python development receipt is `/tmp/opencode/chess-coach-docker-runtime-verification-pYJinp/`, separate from the operator-admission receipt.
Its later `python-tests-final.stdout` is empty; `python-tests-final.stderr` records all 98 Python tests passing in 0.892 seconds: baseline 74 plus 24 added proposal tests.
The preceding `python-tests.stdout`/`python-tests.stderr` retain the 97-test caller-guard run in 0.994 seconds; the later run adds the independent literal-allowlist regression.
`verification.json` records both runs and a prior focused-test depth-expectation failure; retain that failed-development chronology rather than replacing it with the final pass.
It also lists AST/TOML/local-link/receipt-JSON/whitespace checks and the existing gate-closure diagram's check/render; the actual `gate-closure.svg` and `plantuml.stderr` remain retained.
No other diagram or Cargo/Rust/Bun/TypeScript source changed in that Python slice, so those full suites were not rerun; this skip rationale does not cover a later Rust implementation.

The review sequence overrides any suggestion that passing Python fixtures accepted the packet:

1. Security reported MEDIUM CWE-200 exposure in the new tracked inventory summary and `READY TO MERGE: no`; the summary was redacted while the private report stayed unchanged, and subsequent privacy review resolved that finding.
2. Adversarial review then reported HIGH unregistered CLI plugin execution through `create --help`/`info`, plus help's possible daemon contact and hidden failure.
3. Adversarial review also reported MEDIUM socket-path/executable-path metadata-to-use races.
4. The Python operator proposal is blocked and superseded; security redaction does not resolve the separate HIGH findings.

These review findings were supplied by the lead; the private `verification.json` review field records rejection after the adversarial HIGH finding, not a later pass.
The adjacent `operator-packet-draft.json` explicitly marks the unpublished Python proposal rejected and forbidden for execution; it has no frozen source manifest and must not be presented as the Rust packet.
The lead removed only the added Python runtime profile/helpers/test/task, preserving the earlier Python tasks; the fresh Rust-slice receipt above retains the restored 74-test baseline pass.
The existing Python helper and preserved Python task bodies no longer contain the proposed Python runtime profile, and its new Python test file is absent.
The original failed-source and test logs remain retained; removal does not turn the failed proposal into an accepted packet or supply Rust proof, a source freeze, daemon contact, host qualification or publication approval.
Keep all Gate0/F9/R4/GPU qualification and training-readiness results unchanged.

## Earlier verification chronology

The preceding bounded-contract receipt is `/tmp/opencode/chess-coach-ii-sbx-contract-verification-d2noe53n/`.
Its private `operator-reported-root-preflight.json` retains the returned v2 report and warnings.
The contract task selects sbx once and queries exactly six fixed help pages, retaining earlier receipts even after a query exception.
Executor subsequently returned the successful six-command help packet without executing the listed operations.
Those reports do not establish actual resource admission, provisioning or training.
The preceding preflight-v2 correction receipt is `/tmp/opencode/chess-coach-ii-preflight-v2-verification-rt8qi3t6/`.
It reproduces the original combined size/type failure with a synthetic four-byte limit and proves explicit metadata-only skipping without reading the oversized fixture.
It preserves the two operator-reported host failures separately from agent-executed synthetic checks.
Executor reported host mise 2026.5.16 rejecting task-level `output`, then a v1 executable-check failure after independently updating to 2026.11.3.
The corrected task uses supported `raw`/`quiet` fields and no task-level `output`.
The actual installed-2026.5.16 binary was not part of local verification.
At correction delivery, actual host root help remained pending.
Executor subsequently supplied a passing v2 metadata/root-help report, preserving both skipped hashes and denied-home initialization warnings.
That operator report supplies no provisioning, workload, final artifact or runtime-control qualification.
The current diff leaves the previously verified Rust/Bun learning/game runtime unchanged.
Its complete pipeline results below remain the last full pass rather than a new full-pipeline run or host qualification.

The fresh complete Rust build/tests/formatting/Clippy, Bun, TypeScript, Python, actual mise parser/task-discovery and diagram receipts are in `/tmp/opencode/chess-coach-ii-host-mise-verification-uxq71elx/`.
The parser check invokes no real sbx command.
The preceding selected Cargo/Bun/TypeScript/native/development-Python closure receipt is `/tmp/opencode/chess-coach-ii-host-mise-closure-reed_eg3/`.
The current admission import inventory supplements its Python portion without claiming a new Cargo/Bun/native build or GPU runtime closure.
Both remain development evidence rather than independent Gate0 registration or actual host/runtime qualification.
The previous complete C15 receipts and development-source hashes remain in `/tmp/opencode/chess-coach-ii-c15-final-source-verification-e7dwst2t/`.
The preceding full corpus/RNG/strategic static-fixture receipts remain in `/tmp/opencode/chess-coach-ii-whole-match-verification-ks8hbbpi/`.
The fresh complete Rust/formatting/Clippy pass remains in `/tmp/opencode/chess-coach-ii-whole-match-rust-9nm840m8/`.
The development current/old-reference/type/native/control-plane inventory remains in `/tmp/opencode/chess-coach-ii-whole-match-closure-vt35ni4l/`.
All previous failures and synthetic evidence remain preserved.
The real separate-process fixture first exposed incomparable parent/child `hrtime` values; the corrected worker uses local guards while the owner retains raw deadline authority.
The C3 Docker queries and earlier synthetic Docker grant remain consumed.
C16 subsequently received and consumed its own exact read-only grant.
Its two formatted Docker queries and listed self/cgroup/CPU/statvfs/executable-metadata observations completed in 172.403 ms.
That partial inventory is recorded in [host-binding-inventory-request.md](host-binding-inventory-request.md).
No container, image-layer capture, production image build, controller write, workload inspection or game-data training operation occurred.
The subsequent separately authorized C17 self-path/mount-view observation completed in 22.109 ms and is consumed.
It found usable cgroup-view proposals but no accepted full-ceiling private storage target.
See [host-view-followup-request.md](host-view-followup-request.md).
These receipts do not register Gate0 artifacts or authorize execution.
Executor subsequently corrected their realm to sbx-local observations.
Do not promote C16/C17 to actual host CPU/storage/cgroup authority or treat their free-space samples as host provisioning limits.
The host-executed mise amendment, completed sbx-help discovery and received operator-reported Docker-client/GPU/filesystem facts are recorded in [host-entrypoint.md](host-entrypoint.md).
C19 remains authorized but unexecuted and paused.
The agent has executed no actual host sbx commands.
The subsequent operator-reported root and six subcommand help reports contain no provisioning or workload operation.
Executor selected host-backed state and actual F64 GPU learning in a shared-GPU host Docker job while keeping the coding agent in sbx and the active GPU attached to its host driver.

## Remaining gates

[gate-closure.md](gate-closure.md) records the retained/superseded/unresolved acceptance matrix and source/test critical path. Proposed paths are not passing evidence. Gate0, F9 and R4 remain open. Executor selected the supported-runtime rebaseline under C1; full implementation and runtime evidence remain pending. Existing development authorization remains separate from fresh capture/build/runtime/native-proof grants.

Complete physics, causal recipients/economics, closed native/policy/match protocols, redundant Burn numerics and synthetic whole-match/SQLite publication now have persisted checks.
Actual captured runtime, loading, effective controls, independent confined reference/lifecycle, durable target and original-clock qualification remain open.
The current manifests and three native entrypoints still select CPU Flex.
Optional CUDA source reconstruction does not establish a supported/qualified backend, a GPU build, or real F64 GPU forward/backward/SGD/reload/redundant-learner/VRAM/cleanup proof.
The metadata task and synthetic tests do not satisfy mandatory GPU learning readiness.
Training readiness remains false.
Apply active AGENTS.md adversarial and applicable security review gates after implementation and feasible verification, before completion; do not defer them until readiness.
The corrected [gate-closure.puml](gate-closure.puml) applies active AGENTS adversarial/security gates; it does not defer each implementation slice's reviews until readiness.
The scoped admission/GPU publication approval does not authorize further publication or game-data training.

The scoring subprocess consumes actual feature encoding derived from bounded synthetic fixtures, including continuing observations produced by the actual causal source pipeline. Hidden-state-twin e2e checks compare candidate order, feature values and frozen native Burn scores. The new representation, context-dependent MLP and feature/model-artifact binding have source tests. No placeholder economic readout, custom estimator or missing-channel zero padding ships. The operator approved replacing DIRECT metering with shared standard OS-resource limits. The one-shot synthetic grant is consumed. Production resource admission still requires concrete limits, separate host-operation authorization and applicable pipeline/deadline verification; byte caps and the synthetic proof do not establish it.
