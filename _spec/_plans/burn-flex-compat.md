# Burn Flex compatibility proof — bounded checks and closing reviews closed

**[Unverified] 2026-10-17: CODE CHECKS PASS / THREE CLOSING REVIEWS READY / THREE MEDIUM FINDINGS CLOSED — BOUNDED SYNTHETIC MILESTONE ONLY.**
Executor canceled Bun adoption for this milestone and selected Rust with a thin Node engine bridge.
The lead reports all three repair controls included in the frozen `bf42b7c3…` source and its complete passing Rust gate.
The first Rust reviews found process-group timeout cleanup, engine action-domain enforcement, and predictable oracle temporary-path issues.
The prior adversarial review did not close the milestone; prior security and DevOps approvals remained scoped to the earlier synthetic input.
The 24-command gate passed before all three closing adversarial/security/DevOps reviews on the same unchanged source.
The supplied adversarial result closes all three MEDIUM findings; all three closing reviewers report scoped READY.
Their method was read-only static inspection, not independent commands, tests, network access or hash reruns.
The `6dbd…`, `e633…` and Bun receipts remain historical rather than contributing passes to the current invoice.
This author performs no source review, verification execution or acceptance decision.

## 1. Decision and authority

Executor selected a compatibility proof before the full replacement in dedicated
`packages/training` and `apps/arena`.
Rust now owns the ML library, arena policy, CLI, tests and verification driver.
Node executes only the unchanged TypeScript rules engine through the bounded adapter described in §4.
Keep pnpm for the arena adapter and existing repository installations, with tsgo and Oxlint for adapter source and tests.
The migration removed the new training NPM manifest/exports, Bun scoring bridge, Bun test flow and JavaScript verification scripts.
Do not remove or migrate pre-existing Bun uses elsewhere, including the server.

- [Runtime research](../ml/rebuild-runtime-research.md) records the three candidates and supplied upstream sources.
- [Training boundary](../packages/training/burn-compat.puml) records direct Rust scoring and the retained standalone binary protocol.
- [Arena smoke boundary](../apps/arena/burn-compat.puml) records the single-window integration.

The lead reports that mise `2026.9.1` was installed and Rust/Cargo were absent before setup.
Executor approved a scoped Rust `1.95.0` installation inside the approved runtime cache.
Mise installed Rust `1.95.0`, rustfmt, and Clippy in the scoped cache.
Executor separately approved Zig `0.15.2` because the sandbox had no native linker or C development files.
Mise installed Zig in that same cache without sudo or shell-profile changes.

Executor subsequently allowed upstream dependencies to use Python.
Our implementation remains Rust and TypeScript; no Python bridge enters the runtime.
This milestone authorizes no real training, profiling, activation or learned model artifact.
It changes no accepted legacy contract, evidence body, historical result or admission rule.
It grants no Git operation, publication or deployment.

## 2. Ownership and present source

The lead reports these source owners present in the final frozen input recorded in §7.
This table records that supplied ownership; this author did not inspect or review source.

| Source | Responsibility |
|---|---|
| `Cargo.toml`, `Cargo.lock` | One root workspace and lock for training, arena and xtask. |
| `packages/training/Cargo.toml` | Package `training-native`, moved up from the former nested native crate. |
| `packages/training/src/lib.rs` | Direct `training_native::score_synthetic_f64` library API. |
| `packages/training/src/model.rs` | Explicit binary64 Burn model and numerical compatibility fixtures. |
| `packages/training/src/main.rs`, `packages/training/src/protocol.rs` | Retained standalone Rust score-only protocol binary. |
| `packages/training/tests/protocol.rs` | Retained executable protocol integration tests. |
| `apps/arena/Cargo.toml` | Rust package `arena`; Node adapter retains its separate pnpm installation surface. |
| `apps/arena/src/lib.rs` | Rust policy orchestration and direct Burn library call. |
| `apps/arena/src/bridge.rs`, `apps/arena/src/protocol.rs` | Bounded Node process driver and closed typed request/reply contracts. |
| `apps/arena/src/observation.rs`, `apps/arena/src/features.rs` | Limited-observation validation and two padded feature rows; Rust validates semantic native square values. |
| `apps/arena/src/main.rs` | Rust CLI and non-admitted synthetic report. |
| `apps/arena/tests/smoke.rs` | Actual Rust CLI/Node bridge integration tests. |
| `apps/arena/engine/worker.ts`, `apps/arena/engine/protocol.ts` | Fixed one-shot Node worker and closed `arena-engine-v1` protocol. |
| `apps/arena/engine/observation.ts` | Native fog projection and acting-side resources only. |
| `apps/arena/engine/admission.ts`, `apps/arena/engine/fixture.ts` | Atomic engine admission/bank settlement and reconstructed `tiny-v1` fixture. |
| `apps/arena/engine/test/observation.test.ts`, `apps/arena/engine/test/admission.test.ts`, `apps/arena/engine/test/protocol.test.ts` | Complete Node adapter test suite. |
| `tooling/xtask/src/main.rs`, `tooling/xtask/src/lib.rs` | Rust verification CLI and library. |
| `tooling/xtask/src/identity.rs`, `tooling/xtask/src/invoices.rs`, `tooling/xtask/src/preservation.rs`, `tooling/xtask/src/runner.rs` | Rust verifier identity, invoice, preservation and process-execution modules. |

The lead reconciled the two source-contract diagrams/index entries to 14 training and 20 arena declarations without changing the 43 old entries.
Generated-lock coverage follows upstream Cargo manifests; root Rust toolchain configuration is covered instead of treating `Cargo.lock` as an independent source owner.
Existing apps, server consumers and legacy training/arena implementations remain unchanged in this proof.

## 3. Native dependency and numeric contract

Pin Rust exactly to `1.95.0` and Burn exactly to `0.22.0` in the root Cargo workspace.
Reuse the existing native crate's lock resolution in one root `Cargo.lock`; do not retain a second active nested lock.
Select only the `std`, `flex`, `optim` and `store` Burn features, without default-feature expansion.
Cargo resolution encountered yanked `zip 0.6.6` through Burn's disabled optional LibTorch branch.
Keep Burn `0.22.0` per Executor's instruction.
Use the release lock's checksum-matched entry, without enabling LibTorch.
The verification gate rejects `zip`, `tch`, `torch-sys`, or `burn-tch` in the selected normal/build dependency graph.
Do not add the `train`, `cpu` or `tch` features, a Python bridge or a network execution path.
Flex remains the selected pure-Rust **CPU** backend; omitting the feature named `cpu` does not prohibit CPU execution.

Configure the floating-point dtype as `f64` **before** constructing tensors, parameters or autodiff state.
Widening values after an `f32` operation cannot satisfy this contract.
Use native Burn autodiff, its actual SGD optimizer and its actual Burnpack checkpoint support.
Hand-coded gradients, a substitute optimizer and handwritten JSON checkpoints cannot supply those compatibility proofs.

The only runtime model is the fixed fixture `synthetic-linear-418-v1`:

```text
input width = 418
weights     = [0.5, -0.25, 0, ..., 0]
bias        = 0.125
score(x)    = dot(weights, x) + bias
```

Only the synthetic tests may perform the bounded optimizer update described below.
The scoring library and retained standalone binary construct the fixed fixture; neither loads fitted parameters.
Temporary synthetic checkpoint fixtures are not admitted or published model artifacts.
Width 418 is padding for compatibility, **not** the R4 economic feature encoder or an implementation of its semantics.

<a id="4-typescriptnative-process-contract"></a>
## 4. Rust library and Node engine contracts

### 4.1 Direct Rust scoring

The Rust arena calls `training_native::score_synthetic_f64` directly.
The policy path requires no Bun runtime, JavaScript scorer, FFI bridge or scoring child process.
The library preserves the validated 418-wide finite-row contract and binary64 arithmetic.
Failure remains closed; do not substitute JavaScript, another backend or `f32` computation.

### 4.2 Retained standalone scorer — test surface, not arena transport

Keep the Rust `training-native` binary and its closed `training-burn-compat-v1` score-only protocol tests.
Its requests retain a uint32 identity, 1–512 rows of 418 finite values with absolute magnitude at most `1e6`, and an 8 MiB input cap.
It reads one JSON request through stdin EOF and emits one JSON response plus newline with matching identity and ordered finite scores.
Retain bounded output and rejection of invalid framing, unknown operations, model/checkpoint paths and invalid data.
The removed TypeScript child-process wrapper is not part of the new runtime contract.

### 4.3 Thin Node engine bridge

The Rust driver fixes the Node executable, `--import tsx`, the entrypoint identified repo-root-relatively as `apps/arena/engine/worker.ts`, and child cwd `apps/arena`.
The driver resolves that fixed entrypoint; request data cannot select a script or executable.
Do not invoke a shell, evaluation mode, package installation or Cargo from the policy runtime.
Clear inherited environment values, including `NODE_OPTIONS`; logs remain data rather than commands.

| Boundary | Selected contract |
|---|---|
| Protocol | Exact `protocol:'arena-engine-v1'`, uint32 `id`, exact operation discriminator. |
| Process model | Two one-shot processes: `open`, then `settle`; each independently reconstructs `tiny-v1`. |
| Input framing | One closed JSON request on stdin, terminated by EOF. |
| Output framing | One closed JSON response on stdout; bounded stderr carries diagnostics only. |
| Byte limits | stdin 64 KiB, stdout 1 MiB, stderr 64 KiB. |
| Deadline | 30 seconds total, **including** a reserved 3 seconds for termination/reaping; not 30 + 3 seconds. |
| Platform | Linux/Unix engine bridge; Windows is unsupported, with no broader portability claim. |
| Caller input | Fixed fixture identity and, for `settle`, one closed white classical action; no snapshot, bank, model path or checkpoint path. |
| Response validation | Exact protocol/id/op, closed typed DTO validation and equality of the returned reconstructed open observation across both calls. |
| Failure | Reject invalid, oversized, mismatched or incomplete replies and child failures/timeouts; no substitute policy or engine. |

The closed request shapes are:

```text
open   = {protocol:'arena-engine-v1', id:uint32, op:'open', fixture:'tiny-v1'}
settle = {protocol:'arena-engine-v1', id:uint32, op:'settle', fixture:'tiny-v1', action}
action = {kind:'classical', timing:'C', color:'w', from:e1, to:d1|f1}
```

Square names above identify native squares, not a new wire encoding.
Rust validates semantic native square values; the Node adapter also applies actual native admission checks.
The `open` reply contains `{protocol,id,ok:true,op:'open',observation}`.
The `settle` reply contains `{protocol,id,ok:true,op:'settle',observation,result}`.
The repeated observation describes the independently reconstructed open fixture and must equal the earlier `open` observation.
Use the existing fixed 64-cell, own-resources-only observation schema; Rust validates its limited typed form before policy input.

The closed `result` fields are:

```text
initialScfen, openScfen, committedScfen, finalScfen,
bankBefore, bankCommitted, bankAfter,
requestedActions:{w:[action], b:[]}, rawBegin, rawResolve
```

Those full-truth settlement details arrive only after action selection and serve reporting/replay assertions.
They never re-enter the feature encoder or scorer.
Typed raw JSON values are confined to those report fields rather than accepted as limited policy observations.
The two reconstructed calls establish no persistent session, arbitrary-state replay API or full stateful match runner.

## 5. Synthetic compatibility fixtures — final scoped Rust gate PASS

### 5.1 Analytic loss, autodiff and actual SGD

Pad both rows below with 416 zeros.
Keep the model's initial weights and bias from §3.

```text
X       = [[1, 2], [3, 4]]
y       = [1, -1]
N       = 2
L       = sum((prediction - y)^2) / (2 * N)
predict = [0.125, 0.625]
L       = 0.8515625
grad_w  = [2, 2.375, 0, ..., 0]
grad_b  = 0.375
SGD lr  = 0.125, without momentum or weight decay
next_w  = [0.25, -0.546875, 0, ..., 0]
next_b  = 0.078125
```

The half-mean-squared loss definition is normative for this fixture.
An ordinary mean-squared loss without the factor `1/2` would produce different gradients.
Assert the independent analytic values against Burn's computed loss, autodiff gradients and optimizer update.
Include the padded zero coordinates in those assertions.
Do not substitute the analytic update for the actual optimizer call.

### 5.2 Binary64 discrimination

Score rows whose first coordinates are `1` and `1 + 2^-30`, with all other coordinates zero.
The expected score difference is `2^-31` under the initial weight `0.5`.
The inputs collapse together in `f32`; equal scores cannot establish the required `f64` path.
This fixture checks precision preservation rather than throughput or memory use.

### 5.3 Native checkpoint roundtrip

Serialize a synthetic fixture through Burn's real Burnpack implementation.
Restore it and compare every parameter's binary64 bits exactly.
Reject corrupt checkpoint data.
Do not replace this path with manual JSON or expose checkpoint loading through the runtime protocol.
The fixture establishes no general checkpoint durability, learned-artifact admission or training result.

## 6. Arena proof — one native planning window

Use only the tiny engine fixture: own king on `e1`, enemy king on `e8`, own bank `3`.
Keep the full engine snapshot inside the Node adapter before selection.
Node projects exactly 64 ordered cells using the native visibility result, preserving hidden-cell positions without hidden enemy contents.
Expose only the acting side's resource values to the Rust policy.
Two full states that differ only in hidden information must yield the same projected observation.

Construct exactly two fixture proposals: own king to `d1` and own king to `f1`.
Each row contains the destination's fixed file/rank coordinates followed by 416 zeros.
The fixture owns its coordinate convention; this is not a general board encoder or candidate generator.
Rust validates the limited observation, constructs both rows and calls `training_native::score_synthetic_f64` in process.
Select the highest score, breaking equal-score ties by the fixture's canonical proposal ordering.

Send only the selected white action in the `settle` request.
Node reconstructs the fixed open state and stages the selected proposal and opposing empty pass against that **same open state**.
Node admits both through the existing native add/end path as one atomic pair.
Do not mutate the live state after admitting only one seat.
Preserve the separately held bank across native snapshot transitions.
Use native income rules and reapply the retained bank without omitting or duplicating income.
Independent replay tests must derive the same successor state and economy from the recorded pair.
Do not implement a second rules engine or compare a function only with its own output.

Every proof result must retain these scope markers:

```json
{
  "milestone": "burn-flex-compat-v1",
  "scope": "synthetic",
  "assurance": "NON_ADMITTED",
  "modelArtifact": null,
  "fullRunner": false
}
```

This is not a learned policy, a full match, a scheduler, an R4 proof or an upgrade of an existing consumer.
Learned weights remain **NONE**; the fixed synthetic coefficients are not fitted weights.
Historical UI registry behavior and existing consumers remain unchanged.

<a id="7-lead-owned-gates--all-pending"></a>
<a id="7-lead-owned-gates--pass"></a>
<a id="7-lead-owned-gates--fresh-rust-proof-pending"></a>
<a id="7-lead-owned-gates--pass-reviews-pending"></a>
## 7. Lead-owned gates — PASS; bounded reviews closed

### 7.1 Current repaired-source receipt and completed closing reviews

The current complete receipt is `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-52254-1792198270804750420-0/receipt.json`.
It records `inputSha256 == inputSha256After == bf42b7c3020d5f55b87fd14a35b24ec502ae83cb7a4f92882bfc9ab9ad58d7f6`,
`status:PASS`, `reviewEligible:true`, `error:null` and `identityError:null`.
All 24 commands recorded exit `0`, signal `null` and `timedOut:false`; the lead confirms unchanged source, configuration and dependencies throughout the invoice.
Each result also records `cleanupError:null`, `cleanupTimedOut:false` and `reaped:true`, separately from the actual exit/signal.
The fixed inventory, command results and raw logs belong to this single repaired input, not a combination of earlier runs or scoped repair probes.

The Rust `cargo xtask check` alias invokes package `xtask` with `--frozen` and owns verification without a Node/Bun verification helper.
The actual CLI fixture produced scores `[1.875, 2.875]`, selected king `f1`, and settled bank `3` → `4` through the fixed two-one-shot Node/tsx bridge.
All three closing review calls followed the complete repaired-source gate; their supplied scoped READY results are recorded in §7.5.
The lead reports no code changes after the `bf42…` freeze or closing reviews; any later hashed-input edit invalidates this input's verification/review scope.
Markdown and external theme bytes are explicitly outside the receipt's identity policy, so this two-file Markdown update does not change code identity `bf42…` or supply a self-hash for its new text.
The lead completed the final same-source full gate after the closing reviews: [confirmation receipt](/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-56262-1792199153186602997-0/receipt.json).
That run again passed all 24 commands, 76 Rust tests, 27 Node adapter tests and 668 core tests, with the same `bf42…` before/after identity.
The final `git diff --check` passed; no commit or push ran.

| Gate | Recorded final scope | Current status / actual count |
|---|---|---|
| Toolchain and inventory | Rust/Cargo `1.95.0`, Node `22.23.2`, pnpm `10.33.0`, tsgo `7.0.0-dev.20260707.2`, Oxlint `1.77.0`; scoped mise/Zig `0.15.2` provisioning complete. | PASS / versions and fixed inventory recorded |
| Workspace layout | Root training-native/arena/xtask workspace, one root lock, retired training NPM/Bun bridge and JavaScript verifier removed. | PASS / supplied frozen source scope |
| Rust static checks/build | `rust-format`, `rust-check`, `rust-lint`, `rust-build`; workspace check/Clippy cover all targets with frozen/offline resolution and Clippy warnings denied. | PASS |
| Selected native graph | `selected-native-dependencies`: Burn 0.22.0/Flex f64; `zip`, `tch`, `torch-sys`, `burn-tch` absent from selected normal/build graph. | PASS |
| Rust unit tests | `rust-tests`: training library 9, arena library 21, xtask library 27. | PASS / 57 unit tests; part of Rust total 76 |
| Rust integration tests | Same `rust-tests`: training standalone protocol 12 and arena CLI/bridge integration 7. | PASS / 19 integration tests; Rust total 76, 0 failed/ignored/filtered/skipped/todo |
| Adapter lint and types | `lint-engine`, `types-engine`: all Node adapter source **and tests**, under the same core-compatible strict engine profile. | PASS / no own source or test exclusion |
| Node adapter tests | `engine-tests`: complete `node:test` adapter suite, including repaired action-domain checks; not Bun. | PASS / 27, 0 failed/ignored/skipped/filtered/todo |
| Native engine regressions | `core-tests`: fresh, unfiltered full core suite on this final input. | PASS / 668, 0 failed/pending/todo |
| Other app/server/legacy consumer suites | Unchanged source and existing resolved dependencies establish the lead's not-affected scope; pre-existing server Bun use was not migrated. | NOT RERUN / outside affected scope; not a test PASS |
| Boundary preservation | `legacy-preservation`: legacy core/arena/training, server/web and evidence bytes unchanged; own Rust/TS implementation has no Python bridge, real training/data/profiling/activation/model artifact or legacy cleanup. | PASS / preservation scope, not unrun test suites |
| Dependency/root preservation | `baseline-lock`, `baseline-package` and Rust preservation checks retain existing pnpm importers/packages/snapshots and root Nx devDependency. | PASS |
| Verifier process control | Owned-process-group cleanup and independent cleanup/reap fields; unchanged 600-second job total includes 597 seconds work and 3 seconds cleanup reserve. | PASS / repair controls included in full gate |
| Spec integration | `baseline-spec-index` and preservation checks retain all 43 old entries; lead-reconciled coverage is 14 training/20 arena; both source-bound diagram `checkonly` commands passed. | PASS / no hermetic rendering claim |
| Receipt-time whitespace | `whitespace` passed on the receipt input; this later Markdown text was not checked by this author. | PASS / receipt-time scope only |
| Closing reviews | All three read-only static closing reviews followed the complete gate on unchanged `bf42…` source; supplied results appear in §7.5. | CLOSED / 3 bounded READY results |

Skipped, ignored, todo, filtered-away and empty required suites cannot count as passing gates.
The lead must preserve all required assertions rather than relabel an empty selection or old count as fresh proof.
This author invokes no reviewer, performs no source review and issues no verdict.

### 7.2 Recorded test owners

| Actual path / owner | Final receipt test count / scope |
|---|---|
| `packages/training/src/lib.rs`, `packages/training/src/model.rs`, `packages/training/src/protocol.rs` | 9 library tests combined: f64 model, analytic gradients/actual SGD, Burnpack and protocol boundaries. |
| `packages/training/tests/protocol.rs` | 12 standalone Rust binary protocol integration tests. |
| `apps/arena/src/lib.rs`, `apps/arena/src/bridge.rs`, `apps/arena/src/protocol.rs`, `apps/arena/src/observation.rs`, `apps/arena/src/features.rs` | 21 arena library tests combined; no per-module totals inferred. |
| `apps/arena/tests/smoke.rs` | 7 actual CLI/Node bridge integration tests, including exclusive temporary-oracle regressions. |
| `tooling/xtask/src/lib.rs`, `tooling/xtask/src/identity.rs`, `tooling/xtask/src/invoices.rs`, `tooling/xtask/src/preservation.rs`, `tooling/xtask/src/runner.rs` | 27 verifier library tests combined, including process-group cleanup regressions. |
| `apps/arena/engine/test/observation.test.ts`, `apps/arena/engine/test/admission.test.ts`, `apps/arena/engine/test/protocol.test.ts` | 27 Node adapter tests combined. |
| `packages/starchess-core` | 668 tests in the complete unfiltered core run. |

### 7.3 Superseded Bun receipt — history only

The old receipt remains at `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/burn-compat-1elp9d/receipt.json`,
input SHA-256 `d250c88e223ec678ad1f1834b8f40d517fd9c971b9e1531c10e8b5c814419eea`.
It recorded 20 commands PASS, native 21, Bun unit 57, Bun integration 8 and core 668, including the old TS → Rust `2^-31` fixture and king `e1` → `f1`, bank `3` → `4` result.
Its `reviewEligible:true` and `error:null` describe only that superseded input; neither grants current Rust review eligibility.
The lead canceled the old adversarial/security reviews without a closing result; no old review approves the selected migration.
Prior failures, compiler-profile corrections and raw logs remain historical rather than being overwritten or reused as current passes.

The lead's earlier Rust checkpoint `e633…` predates the source-contract diagram metadata and remains historical too.
The prior Rust receipt `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/rust-training-46248-1792196686700950188-0/receipt.json`
retains source `6dbd24f497fce8a84df7de945774eda692181eadfccd0754e4fdd58727a8cba5`, 24 passing commands, Rust 72, Node 24 and core 668 only for that older input.
Its subsequent adversarial review declined closure with three MEDIUM findings.
Security reported scoped approval; DevOps reported scoped approval while also identifying the process-group issue.
Those prior results do not approve repaired `bf42…` source; its closure comes only from the later supplied closing reviews in §7.5.

<a id="74-repair-control-evidence--verified-controls-no-closing-verdict"></a>
### 7.4 Repair-control evidence — MEDIUM findings closed by supplied reviews

The lead supplied the following repair descriptions and red/green records.
The current full `bf42…` invoice includes the regression tests; scoped green probes below are not stitched together as its proof.
This author records the evidence and supplied reviewer closure without inspecting code or issuing an independent verdict.

| Reported item | Control recorded in the repaired source | Verification scope / closing status |
|---|---|---|
| M1 — verifier descendants survived direct-child timeout cleanup | Unix `Command::process_group(0)` creates a fresh owned group; safe `rustix` process APIs pinned at `1.1.5` validate child PID > 1 and reject the parent group before signaling. Timeout/wait-failure handling kills the owned group and uses bounded `try_wait` cleanup. | Control verified in full gate; CLOSED by supplied adversarial and targeted DevOps closing results. |
| M2 — Node parser accepted unsupported destinations/actors | `parseRequest` now requires white classical C from `e1` to `d1` or `f1`, matching Rust's `validate_tiny` action domain. Outside-grammar `from:a1` fails as `BAD_REQUEST` before admission; native atomicity/refusal helpers remain unchanged. Positive native-end tests cover both destinations. | Control verified in full 27-test Node suite; CLOSED by supplied adversarial closing result. |
| M3 — predictable integration-oracle path allowed symlink overwrite | Test-only `tempfile` is pinned at `3.27.0`; `NamedTempFile` creates an exclusive random-name 0600 file, writes/flushes it, retains ownership until Node completes and removes it on drop. Regressions preserve an owned canary symlink and assert cleanup. | Control verified in full 7-test arena integration scope; CLOSED by supplied adversarial closing result. |

Verifier jobs retain the **600-second inclusive total**, reserving 3 seconds for cleanup after at most 597 seconds of work.
Receipts preserve `cleanupError`, `cleanupTimedOut` and `reaped` independently from actual exit/signal and work timeout.
This control covers trusted descendants that remain in the owned process group; group escape is outside scope and no sandbox is claimed.
The runtime Node bridge still has its separate **30-second inclusive total with 3-second reap reserve**.
Linux/Unix support does not establish Windows bridge support or broader portability.

| Preserved record | Lead-reported outcome; not current whole-gate proof |
|---|---|
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/xtask-descendant-red-Ckj1di4w/receipt.json` | Pre-fix scoped RED: exit 101, 0 pass/1 fail/25 filtered, review eligibility false. Owned canary descendant PID 50503 remained alive initially; RAII cleanup later killed it/observed Z. |
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/xtask-descendant-green-ZyqDS8hE/receipt.json` | Scoped GREEN: 27 xtask tests plus formatting/check/Clippy passed. |
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/engine-domain-red-b4xtPW/stdout` | Pre-fix parser RED: exit 1, 24 pass/2 fail/26 total, 0 skipped; unsupported `e1` → `e2` and non-`e1` actor requests exposed the mismatch. |
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/arena-oracle-repair-red.log` | Pre-fix temporary-oracle regression RED: exit 101. |
| `/tmp/proveo-opencode-runtime-cache-1000-21d690750d3738af14d58c25/tmp/opencode/arena-oracle-repair-green-test.log` | Scoped GREEN: arena total 28 = prior 26 + 2 new oracle regressions; the current full run separately includes all 21 arena unit + 7 integration tests. |

The `rustix` verifier dependency and test-only `tempfile` dependency do not change the selected training-native backend.
Burn remains 0.22.0 Flex CPU f64 with direct in-process Rust scoring; no `zip`/LibTorch/GPU/LLVM/dataset path or learned artifact is introduced.

### 7.5 Supplied closing reviews — bounded synthetic milestone

All three results below apply to the same frozen source `bf42b7c3020d5f55b87fd14a35b24ec502ae83cb7a4f92882bfc9ab9ad58d7f6` and followed its complete 24-command PASS receipt.
Every reviewer used read-only static inspection with no command/test/network execution or independent hash rerun.
These are supplied reviewer results, not this author's verdict or whole-branch acceptance.

| Closing review / session | Supplied result | Method and scope |
|---|---|---|
| Adversarial · `ses_eb8bb56ffffeXDM7vxt53Y2oU5` | READY: yes; all three prior MEDIUM findings CLOSED; no additional findings within the bounded milestone. | Read-only static; same `bf42…` synthetic compatibility source only. |
| Security · `ses_eb8bb55ddffeYYYws1w8tDwlEq` | READY: yes; no actionable findings; residual risk LOW. | Read-only static; NON_ADMITTED synthetic scope only. |
| DevOps · `ses_eb8bb551cffeJgWzcW3zqdkfL3` | Targeted READY: yes; M1 CLOSED; no new findings. | Read-only static; guarded owned Unix groups and bounded 3-second reap within 600 seconds; escaped groups remain outside the cleanup claim. |

Security identified a cap on retained gate-log growth as highest-value future hardening.
That LOW future item is not an unresolved HIGH or an outstanding closing-review condition.
The current bounded compatibility migration checks and reviews are **CLOSED**; the final same-source confirmation also passed as recorded in §7.1.
No result establishes full-runner/R4/calibration readiness, learned-model admission, whole-branch merge approval or new training/Git/publication authority.

## 8. Deferred full replacement and final deletion order

The bounded compatibility checks and closing reviews are closed; full replacement remains deferred under its separate scope and authority.
That later work must cover candidate generation, scheduling/pairings, full matches, replay and consumer migration in the dedicated projects.
This proof does not implement or certify any of those layers.

Preserve the legacy implementation until replacement parity and affected regressions pass.
Retain a Git-based rollback path under separate Git authority before the migration's final destructive step.
Delete legacy code **last**, after parity and the rollback boundary are established.
Neither this plan nor a synthetic SGD test grants Git operations or legacy deletion now.

## 9. Integration notes

- `PLAN.md` links this milestone and the two source-covered diagrams; historical sections remain unchanged.
- Existing links to the former PASS/PENDING gate anchors remain navigation aliases, not assertions of current status.
- The Node adapter and all its tests use the same core-compatible profile with `strict:true` and no-unused checks; neither own source nor tests are excluded.
- The current Node profile does **not** enable `exactOptionalPropertyTypes` or `noUncheckedIndexedAccess`; those additional flags belonged to the superseded Bun profile, while Rust now owns the semantically validated typed policy contracts.
- `skipLibCheck` applies to dependency declarations rather than excluding own source/tests.
- Neither diagram depends on the removed Bun bridge or JavaScript verification scripts; both point to the Rust xtask owner.
- The current `bf42…` source freeze binds the repaired Rust/Node code and unchanged diagram source; `6dbd…`, `e633…` and Bun receipts remain historical. Markdown is excluded, so this status sync supplies no new source identity or self-hash.
- No `specNotesEnforced` source ratchet exists in this checkout.
- The proposed external `_spec/template.txt` URL returned HTTP 404; the loaded spec skill's conventions govern these diagrams.
- Keep the skill's remote identity include. A source-bound `checkonly` receipt is not hermetic rendering assurance or a pin of mutable upstream theme content; no theme-scope change or SVG generation is claimed here.

### Authored reasoning-note register

FK scores use the note bodies without PlantUML markup and the specified Flesch–Kincaid formula.
Word/sentence/syllable counts make the pronunciation assumptions explicit; these are readability estimates, not verification receipts.

| Diagram / anchor | Words / sentences / syllables | FK grade |
|---|---|---|
| `packages/training/burn-compat.puml` · note bottom of LIB | 32 / 2 / 55 | 10.9 |
| `packages/training/burn-compat.puml` · note bottom of MODEL | 29 / 2 / 54 | 12.0 |
| `packages/training/burn-compat.puml` · note bottom of PACK | 28 / 2 / 53 | 12.2 |
| `packages/training/burn-compat.puml` · note bottom of XTASK | 31 / 2 / 52 | 10.2 |
| `apps/arena/burn-compat.puml` · note bottom of OBS | 29 / 2 / 50 | 10.4 |
| `apps/arena/burn-compat.puml` · note bottom of ADMISSION | 32 / 2 / 57 | 11.7 |
| `apps/arena/burn-compat.puml` · note bottom of BRIDGE | 32 / 2 / 57 | 11.7 |
| `apps/arena/burn-compat.puml` · note bottom of POLICY | 32 / 2 / 60 | 12.8 |
