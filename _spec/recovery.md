# GPU-owner recovery goals

## CURRENT priority — training first (2026-11-09)

Executor's latest accepted direction places **ALL security/privacy hardening and isolation LAST, after the planned training phase is complete and its results are validated**.
The [canonical precedence amendment](gate-closure.md#current-precedence-amendment--accepted-2026-11-09), its [phase 0–LAST roadmap](gate-closure.md#current-accepted-critical-path), [gate-closure.puml](gate-closure.puml) and [current functional readiness checklist](readiness.md#current-precedence--training-functional-readiness-2026-11-09) govern the next planning step.
One bounded upfront dependency/blocker inventory must freeze the accepted functional gates before later work; new security/privacy/isolation requirements go to LAST rather than ratcheting pretraining scope.
Determine whether the selected supported host-backed shared-GPU container path actually needs the old isolated diagnostic pipeline; do not make completing it mandatory by default.
The actual Bun abort remains unresolved, not fixed, and may matter functionally if the selected path depends on it.

The former strict STOP, escaped-group and dual-crash requirements, including native bridge/pidfd/cgroup/service/helper and hardened capture/custody/isolation qualification, are deferred post-training assurance, not governing pretraining gates or accepted implementations.
Retain ordinary bounded execution, original clocks, cooperative GPU ceilings/coexistence, truthful outputs, functional close evidence and all existing game/model/economic and recipient-fact correctness tests.
Keep F64, all 4,670 coordinates and tolerances, exact C12 digests, CPU Flex/master initialization and model/objective/RNG/curriculum/checkpoint/eligibility semantics unchanged.
AGENTS.md implementation reviews remain required for functional correctness and the explicit deferred backlog; Executor already supplied the security/privacy/isolation policy deferral, not a fabricated pass or clearance of historical HIGH findings.

Observed status remains **0/3 diagnostics, no accepted binding, full pipeline halted, `trainingReady:false`**.
The JSON and source/evidence chronology below remain unchanged; old runner-cancellation next-step instructions describe the retained blocked request, not the new training-first roadmap.
The newly selected training-functional profile does not close historical or amended full-assurance Gate0/F9/R4.
Only future accepted functional evidence can change the observed readiness result; training still needs a separate explicit execution grant.
No request, receipt, source, tool, safeguard or configuration changes here.
No unspent diagnostic allowance authorizes the blocked pipeline; no archive capture/acquisition/replay, download, runtime upgrade, helper build, credential use, host/GPU inspection, process/native operation, test, render, training or publication follows.
This documentation-only amendment renews no grant.
No verification commands or native execution accompany this amendment; reviews are read-only.

## Retained recovery checkpoint and chronology — unchanged evidence

Read the original present-tense status and proposed next decisions below under the current precedence amendment, not as renewed pretraining authority.

## CURRENT — reconstructed source, scoped source accepted, operations unqualified

```json
{
  "reconstructionStatus": "SOURCE_RECONSTRUCTED",
  "verificationStatus": "VERIFIED_TEST_SUBSETS",
  "reviewStatus": "REVIEWED_SOURCE_ACCEPTED_OPERATIONAL_QUALIFICATION_OPEN",
  "developmentInputRestoration": "TOOLCHAIN_OWNER_DEFAULT_CPU_RESTORED",
  "ownerInputVerification": "LOCKED_INPUTS_RESTORED_AND_FRESHLY_VERIFIED",
  "trainingReady": false,
  "actualGate0": null,
  "selectedUuid": null,
  "startupMinFreeBytes": null,
  "runningStopBelowFreeBytes": null,
  "samplePeriodNs": null,
  "maxSampleAgeNs": null,
  "outsideControl": null,
  "observationPaths": null,
  "stateHostSource": null,
  "exclusivePacketRoot": null,
  "telemetryProvider": null,
  "imageId": null
}
```

Executor supplied `c04a8da94` as the clean recovery baseline.
This document preserves accepted recovery goals and separates new repository-owned evidence from the lost implementation/log history.
The earlier task work and private receipts were lost; new source files do not recover those bytes or review verdicts.
Historical `/tmp` paths in older documents are provenance references, not available evidence or locations to reuse.
No GPU-owner or cooperative-policy source existed in the inspected baseline; reconstructed owner, policy, protocol, job, integration, and fixture files now exist.
The corrected Rust owner passes 72 synthetic cases, locked/offline Clippy `-D warnings`, and direct rustfmt checks in fresh source-bound receipts.
Its public `RawLaunchRequest`, `Report`, `run_once`, and `run_once_with` connect the reconstructed modules; passing source subsets do not establish source-review or operational acceptance.
`SOURCE_RECONSTRUCTED` names the connected disabled source implementation, not final source closure, recovered historical bytes, CUDA compilation, or runtime acceptance.
The fresh receipts below establish selected owner/default-CPU inputs, synthetic owner/Bun policy/bridge, reference-guard, harness, and earlier diagram results only.
Current Rust security, authenticated TypeScript security, scoped integer-contract, and final adversarial verdicts are persisted and accepted in their reviewed source scopes.
`SOURCE_REVIEWS_ACCEPTED_SCOPED` abbreviates `REVIEWED_SOURCE_ACCEPTED_OPERATIONAL_QUALIFICATION_OPEN`; neither label grants operational permission.
The raw object-graph repair retains 25 guards / 194 assertions plus the affected test typecheck; packet-5 acceptance comes from the new persisted verdicts, not inherited packet-4/no-filter acceptance.
The old TypeScript security verdict is historical and accepts no current corrected source.
The [implemented object-graph contract](reference-bundles.md#current--implemented-source-verified-subset-scoped-source-acceptance) and its [sequence](reference/object-graph-authentication.puml) describe verified subsets and scoped source acceptance, not runtime qualification.
This spec pass executes no commands, acquisition, render, or source review.

The current requirements are [gpu-owner.md](gpu-owner.md) and [gpu-cooperative-policy.md](gpu-cooperative-policy.md).
Their diagrams describe reconstructed source, verified synthetic subsets, and scoped source-review acceptance, not operational qualification.
[readiness.md](readiness.md), [verification.md](verification.md), [runtime-plan.md](runtime-plan.md), [supervision.md](supervision.md), and [gpu-readiness.md](gpu-readiness.md) link these goals.
Where those documents retain old present-tense success statements, read them as historical reports unless a new repository-owned receipt independently verifies the reconstructed source.

## Retained scope and numerical contracts

- Reconstruct an optional CUDA score/channel path with F64 throughout and no CPU fallback on a selected GPU path.
- Keep the default CPU Flex path, master seeds `101..105`, and initialization unchanged.
- Preserve all 4,670 finite-difference coordinates with `eps=1e-6`, `atol=1e-8`, and `rtol=1e-5`.
- Preserve exact C12 redundant-learner digests and all existing model, objective, RNG, curriculum, checkpoint, and failure semantics.
- Keep frozen Python F9 supervision, `packages/runtime/src/job.ts`, existing state validators, C5 Dockerfile, and metadata collector source unchanged.
- Isolate the new owner in `crates/gpu-owner`; add only its root workspace membership and crate-local dependency/feature declarations during implementation.
- Keep the owner free of host-facts, Burn, and application dependencies.
- Keep both ordinary GPU owner and Bun GPU-job mains disabled; restore test-facing adapters without enabling a real launch path.

Optional CUDA compilation does not make GPU qualification optional for training readiness.
Neither source restoration nor a synthetic fixture can set `trainingReady:true`.

## Exact recovered file plan

| Boundary | Recovered path |
|---|---|
| Rust owner and its pure policy | `crates/gpu-owner/**` |
| Pure Bun policy | `tooling/runtime/gpu-policy.ts` |
| Policy tests | `packages/runtime/tests/gpu-policy.test.ts`; `packages/runtime/tests/gpu-policy-conformance.test.ts` |
| Shared 33-trace semantic fixture | `tooling/runtime/fixtures/gpu-policy-traces.json` |
| Closed GPU protocol | `packages/contracts/src/gpu-job.ts` |
| Protocol tests | `packages/contracts/tests/gpu-job.test.ts` |
| Exported GPU-job loop and disabled normal main, in one file | `packages/runtime/src/gpu-job.ts` |
| Runtime job tests | `packages/runtime/tests/gpu-job.test.ts` |
| Trusted fixed-factory integration | `packages/runtime/src/fixed-attempt.ts`; `packages/runtime/tests/fixed-attempt-gpu-owner.test.ts` |
| Coordinator integration | `packages/runtime/src/training-coordinator.ts` |
| Startup hook | `packages/runtime/src/match-session.ts` |
| Owner integration fixtures | `packages/runtime/tests/fixtures/gpu-owner/**` |

Do not invent replacement policy paths, extra GPU-job main files, or new attempt-wrapper source files.
Keep the exact recovered filenames in the diagrams, coverage projection, and verification runner.
The shared trace fixture reconstructs semantics only; neither old exact bytes nor an original fixture hash is available.

## Scoped development inputs — restored selected inputs

Executor explicitly selected `Restore inputs (Recommended)` for narrowly scoped development setup.
Restore Rust `1.95.0` with the minimal profile, rustfmt, and Clippy through repository-local `mise install` plus only the locked dependencies needed for owner/default-CPU source verification.
Anonymous acquisition is allowed only for that selected development closure.
Scoped mise trust may apply only to a new minimal configuration, never ambient project tasks or the untrusted project configuration.
This grant does not authorize this spec-keeper to execute installation or commands.

At the grant boundary Rust was not found; the new receipts now establish repository-local Rust `1.95.0`, minimal profile, rustfmt/Clippy, and restored Zig `0.15.2` as the development CPU linker.
Zig restoration does not change the CUDA compiler route.
`runs/mise-isolation-inspection/` records trust only for `_work/gpu-owner-recovery/mise.toml` and discovery of that minimal config; root `mise.toml` remains untrusted and unchanged.
`runs/mise-rust-1950-install/`, `runs/mise-zig-cpu-linker/`, `runs/rust-1950-identity/`, and `runs/provisioned-tools-identity/` retain installation and identity evidence under `_work/gpu-owner-recovery/`.
`runs/cpu-locked-inputs-restored/` records successful selected locked default-CPU dependency acquisition/build preparation without a lock change.
Selected development input status is `TOOLCHAIN_OWNER_DEFAULT_CPU_RESTORED`; both owner and default-CPU inputs are `LOCKED_INPUTS_RESTORED_AND_FRESHLY_VERIFIED`, not all CUDA/runtime inputs restored or an owner accepted for operation.
`runs/rust-core-check-2/` establishes locked/offline all-targets owner availability; the connected test/static/tree receipts below verify their selected source generations.
Parent owns source/tooling status files and any further acquisition within the existing narrow grant.
Parent has separated `initialRecoveryNewAcquisitionAuthorized:false` from the scoped development grant in `recovery.json`; that restoration grant excludes CUDA/LLVM/NVIDIA inputs, and the separate FFT source-only grant below is consumed.

That restoration grant excludes CUDA, LLVM tooling, NVIDIA/driver/SDK inputs, image/container operations, host/GPU execution, production capture/build/registration, publication, and training; the separate conditional LLVM grant below does not broaden it.
The missing libdevice archive's prior grant stays consumed; reacquisition remains denied.
Frozen metadata assets and collector source remain unchanged.
Parent owns root Cargo/lock edits; the bounded exact lock audit below records the recovered delta without broadening dependency authority.
Leaf CUDA manifest reconstruction does not expand this development acquisition scope.

## Reconstructed dependency and acquisition history

The following identities preserve the accepted history.
They are not new download, install, execution, or production-registration grants.

| Historical item | Exact reconstructed identity | CURRENT disposition |
|---|---|---|
| `cubek-fft` | `0.3.1`; SHA-256 `48451902f1d21d3eb88cadc17a8a7aeb3b582f17484a68e650f44efe74688b73`; depends on CubeCL | Exact local-owner/FFT/four-list delta audited in `recovered-lock-delta.json`; no existing version/checksum or other package block changed; no broader acquisition grant |
| CUDA libdevice archive | 51,321,404 bytes; SHA-256 `0e619cf3d5b27f7c812665599ca9761fc296e56129b24a85d822a5d8a1a3bd75` | `MISSING_BYTES`; acquisition grant `CONSUMED`; no reacquisition, installation, code execution, or production registration |
| Extracted libdevice bitcode | Version `13.4.92`; 465,412 bytes; SHA-256 `93d6b5b9c8b284a2273b2b2578ac42c59b21c9091e1d35bb63a9b7f9072079dd` | Historical identity only; missing archive does not establish present extracted bytes |
| Extracted license | 68,070 bytes; SHA-256 `088381bc2d891e719a2a9398645b00bb45f3b24231473a8283ac7e3e66b8a028` | Historical identity only |
| LLVM/GNU caches and tooling | Earlier development caches | Do not assume availability or silently replace them |
| Published metadata assets | Frozen `c04` assets and unchanged source collector | Historical publication/acquisition grant consumed; do not rebuild, replace, republish, or run the collector under that grant |

`_work/gpu-owner-recovery/recovered-lock-delta.json` records the exact reconstruction against `c04a8da9468f7d443bd27d73a08c0bd7ee0e9d20`:

- Add local package `chess-coach-gpu-owner` and registry package `cubek-fft@0.3.1` with the checksum above.
- `burn-linalg.dependencies += burn-cubecl`.
- `burn-signal.dependencies += burn-cubecl`.
- `burn-vision.dependencies += burn-cubecl, cubecl`.
- `cubek.dependencies += cubek-fft`.

All existing versions/checksums and every other package block remain unchanged in that audit.
The audited root lock SHA-256 is `b2852cbabb1fcedc29146c33a9323eb04401005afa4cb3c8e5de89e16ae66555`; this is a dependency audit, not owner compilation or CUDA feasibility evidence.

## Current readiness continuation — exact input decision

Executor rejected source handoff as a terminal stop; accepted source reviews and selected closing tests remain intermediate evidence toward `trainingReady:true`.
`_work/gpu-owner-recovery/closure.json` records `sourceHandoffIsTerminal:false` and `DECISION_REQUIRED_OR_HOST_VERIFICATION_COMMAND_REQUIRED` as the stopping condition; a new runner-cancellation decision now blocks the selected synthetic diagnostics before any new diagnostic operation.
The exact FFT archive/metadata grant below is `CONSUMED_SUCCESS`; attempts 1/2 remain historical pre-namespace failures, while a later explicit full-scope renewal reached an actual inert namespace PASS in attempt 3.
The current task is `RUNNER_CANCELLATION_DECISION_REQUIRED_BEFORE_UNSPENT_SYNTHETIC_DIAGNOSTICS`; `nextDecisionRequest` points to `_work/gpu-owner-recovery/cuda-bun-compatibility-source-blocker.json`.
The separate `_work/gpu-owner-recovery/cuda-bun-compatibility-request.json` remains conditionally approved and unspent, not source-accepted or runnable.
Exact acquisition and the one private capture remain successful history; the actual private-Bun audit failure still halts the full archive pipeline.
Observed `trainingReady:false` remains unchanged; the new diagnostic-only grant comes from Executor's selection, not source closure, old source acceptance, or read-only planning.
Seven fresh source gates passed, but DevOps HIGH blocks binding and execution; stop for the explicit read-only custody-design/review decision before any diagnostic operation.
No custody-design/review proposal is selected; no repair/test permission, helper build, real-archive retry, or host-only verification command is authorized or established.

### Actual workspace metadata — preserved failure, successful retry

`_work/gpu-owner-recovery/runs/readiness-real-cuda-metadata-1/receipt.json` records the actual root-workspace command, not the earlier stub/surrogate-lock probe:

```text
cargo metadata --manifest-path Cargo.toml --locked --offline --format-version 1 --filter-platform x86_64-unknown-linux-gnu --features chess-coach-policy-io/gpu-cuda
```

The command failed with exit 101 and empty stdout; retained `command.stderr` names missing `cubek-fft v0.3.1` and refuses HTTP because `--offline` was specified.
The receipt records `sourceKind:ACTUAL_WORKSPACE_NOT_SURROGATE`, `sourceChanged:false`, `compilationPerformed:false`, `buildScriptsExecuted:false`, and `networkAcquisitionAllowed:false`.
Root Cargo manifest/lock hashes remain unchanged; no actual host or CUDA/GPU code ran.
This first concrete input failure remains preserved; the successful retry below resolves metadata only, not all later compiler inputs.
It neither supersedes selected closing test/review evidence nor changes the final `source-accepted-diagrams-2` render.

### Phase 1 completed — exactly one crate, not a compiler grant

Executor authorized only the exact FFT source archive and offline metadata retry.
`_work/gpu-owner-recovery/cuda-input-request.json` records `COMPLETED_APPROVED_ACQUISITION_AND_METADATA_RETRY`, grant status `CONSUMED_SUCCESS`, and `futureAcquisitionFromThisGrantAuthorized:false`.
Its complete consumed phase-1 archive allowlist contains one item:

| Input | Exact identity |
|---|---|
| Archive | `https://static.crates.io/crates/cubek-fft/cubek-fft-0.3.1.crate` |
| Length | 56,719 bytes |
| SHA-256 | `48451902f1d21d3eb88cadc17a8a7aeb3b582f17484a68e650f44efe74688b73` |
| Independent checksum authority | Unchanged `Cargo.lock`; request records matching public metadata at `https://crates.io/api/v1/crates/cubek-fft/0.3.1` |
| Destination | `_work/gpu-owner-recovery/cache/cargo/registry/cache/index.crates.io-1949cf8c6b5b557f/cubek-fft-0.3.1.crate` |

`_work/gpu-owner-recovery/runs/cubek-fft-exact-acquisition-1/receipt.json` records PASS; its retained stdout records actual download, verified length/hash, exclusive cache creation, and no other artifact download, compilation, or build scripts.
`_work/gpu-owner-recovery/runs/readiness-real-cuda-metadata-2/receipt.json` records PASS for the same actual workspace locked/offline metadata command, `sourceChanged:false`, and unchanged root Cargo manifest/lock hashes.
The retry executed no compiler, build scripts, GPU code, or host operation; metadata acquisition remained disabled.
`runs/readiness-input-request-validation-1/receipt.json` remains a historical preauthorization PASS, not validation of the subsequently authorized/completed request state; do not rewrite it or the first metadata FAIL.

`_work/gpu-owner-recovery/readiness-cuda-selection.json` records 572 packages and 572 resolve nodes, CubeCL CUDA/LLVM `0.11.3`, `llvm-sys 231.0.2`, bundler `23.1.0-4`, and CUDARC `0.19.10`.
CubeCL CUDA's `cpp` feature is absent; CubeCL LLVM's `amdgpu`/`nvptx`/`std` values are a metadata feature union, not actual compiler units or runtime GPU selection.
`_work/gpu-owner-recovery/cuda-compiler-input-metadata.json` records source-inspected fallback CUDA `13.4`; this establishes no host-driver compatibility or native-linker qualification.
The consumed FFT grant permits no further acquisition, compilation, or build scripts; the prior libdevice grant remains consumed and unrenewed.

### Phase 2 halted — archive-v2 accepted, actual private Bun quarantine abort

Executor selected `Restore and compile (Recommended)` for `_work/gpu-owner-recovery/cuda-llvm-request.json`.
The original grant covered only two pinned LLVM files, gated local installation, and the two isolated Cargo no-run targets below; its first actual failure stopped the sequence.
After capture, the request recorded historical `APPROVED_SEQUENCE_IN_PROGRESS_AFTER_PRIVATE_BUN_CAPTURE`, `authorityGranted:true`, authorization `APPROVED_SEQUENCE_IN_PROGRESS`, phase `PRIVATE_BUN_CAPTURED_ARCHIVE_V2_SOURCE_GATES_PENDING`, and `renewedExecutorDecisionRequired:false`.
The actual audit failure superseded that continuation: current status is `HALTED_AFTER_PRIVATE_BUN_ARCHIVE_AUDIT_INVOCATION_FAILURE_DECISION_REQUIRED`, `authorityGranted:false`, authorization `HALTED_AFTER_FIRST_FAILURE`, phase `HALTED_AFTER_PRIVATE_BUN_ARCHIVE_AUDIT_INVOCATION_FAILURE`, and `renewedExecutorDecisionRequired:true`.
Full-pipeline `implementationPrepared:false` remains unchanged; accepted source/inert/acquisition/read-only-plan evidence establishes neither successful archive audit nor installation, compilation, or runtime compatibility.
Architect/security identified the ancestor ownership as a genuine trust decision; Executor selected only the private snapshot remedy, and architect session `ses_e44a8dd59ffeY3WhDkxuWCCTCJ` approved its source design without weakening executable-binding ancestry policy.
That selected renewal lasted until the private-Bun runtime abort below; the first-failure rule stopped all remaining actions, while expected negative static/synthetic cases remain distinct from actual operational failures.

Initial public metadata reads did not acquire the LLVM archive; the later exact acquisition below verifies both files and the release API/sidecar identities.
The exact previously approved and acquired inputs remain pinned without reacquisition authority or installation qualification:

| Input | Length | SHA-256 |
|---|---:|---|
| `https://github.com/tracel-ai/tracel-llvm/releases/download/v23.1.0-4/linux-x64.tar.xz` | 45,439,652 bytes | `c394bb1b10ac785f16d3d92d688a9343ba869f720e9cf9ca3f1abf2f401f165f` |
| `https://github.com/tracel-ai/tracel-llvm/releases/download/v23.1.0-4/linux-x64.checksums.json` | 297 bytes | `57780b96c702d2ac595c52da61961549450648b8d18f5b81b7a1d06afa83682d` |

The publisher regular-file content hash is `d1b44f818d17fd882d938a625017b31234fc8b726c190b2a5c324e2be3551bbf`; GNU C++ ABI compatibility and full-build isolation remain unqualified despite the later minimal namespace PASS.
Rust's shipped LLVM 22 does not establish the separate LLVM 23.1 native dependency; Cargo offline mode does not prevent arbitrary build-script downloads.

#### Preserved first attempt — Mise setup failure, not namespace evidence

`_work/gpu-owner-recovery/runs/cuda-isolation-probe-1/receipt.json` remains FAIL, exit 1, `sourceChanged:false`; preserve its original stdout/stderr and all recorded fields.
Its stdout identifies stage `00-config`, `mise config ls --json`, exit 1; stderr reports that paranoid Mise cannot parse untrusted `cuda-mise.toml`.
The attempt stopped before trust and before bwrap; it downloaded no LLVM archive and executed no LLVM/native compiler or GPU code.
`_work/gpu-owner-recovery/cuda-isolation-probe-1-classification.json` supplements rather than rewrites this receipt, recording `namespaceCommandAttempted:false`, `namespaceSupportDetermined:false`, and no automatic retry.
The original `isolationProbeAttemptedBeforeLlvmDownloads:true` flag records intended outer scheduling only; neither it nor this failure proves unsupported kernel namespaces or a host blocker.
That first halt remained in force until Executor's later explicit full-scope renewal; the second attempt below does not rewrite the first failure.

#### Source correction — authenticate, trust exact leaf, discover, then task

Paranoid Mise rejects discovery while the selected leaf remains untrusted, so authenticated narrow trust must precede config discovery.
Trust itself must follow an independent pinned outside check because a wrapper self-check cannot authenticate the config before the caller trusts it.
The retained isolation-stage order is a source contract, not permission to bypass the exact grant or later source gates:

1. In the complete private environment, independently validate pinned review, source/shared-helper, request, and raw TOML identities before importing the corrected wrapper/helpers, trusting config, or invoking Mise.
2. Trust only the exact authenticated `cuda-mise.toml` leaf; never trust root, `--all`, or expanded configuration scope.
3. Require sole-config discovery to identify exactly that leaf and revalidate raw tasks-only TOML with no tools, hooks, environment fields, or task dependencies.
4. Invoke only the fixed inert task, preserving first-failure stop and all existing namespace restrictions.

The implemented no-argument `miseStagePlan` and `runMiseStages` trusted-IO consumer enforce stage order, gates before each stage and after each successful stage, config identity, malformed/extra discovery refusal, and first-failure stop.
Any non-null/non-undefined stage failure stops the sequence, including an empty string; falsey error text must not bypass the failure latch.
The halted-grant test fixture is independent of live authorization, so changes to the current request cannot silently remove that rejection case.
The new helper adds no actual Mise calls, program choices, shell fields, supervisor, or timer; its trusted IO must come from the outside caller only after the independent hash gate.
`validateGrant` now requires a fresh authorization status, the first-failure rule, an explicitly known scope/phase, and consistent root status; halted, consumed, renewal-required, or missing approval must fail.
Full-sequence and inert-only renewals remain distinct; passing the probe validator cannot grant LLVM acquisition, installation, or native compilation.
The standalone slice still has no downloader, LLVM installer, or compile path; the full native pipeline remains unprepared.

The inert probe must create a fresh minimal root containing only validated read-only `/usr/bin/true`, its exact libc/loader files, and necessary symlinks, plus private `/dev` without GPU devices and an empty `/proc`.
Expose no home, `/run`, sockets, repository, extra inherited FDs, or parent proc/root/FD paths.
Require fixed `--unshare-user --unshare-net --die-with-parent --clearenv --chdir /` and `-- /usr/bin/true`; prohibit `--try`, network fallback, a new session, or a PID namespace.
One existing outside `runBounded` 30-second deadline must cover Mise → Bun wrapper → bwrap → true; add no supervisor, nested deadline, or renewal.

Use a complete private Mise environment with a ceiling and `cuda-mise.toml` override, disabling root-project config discovery, hooks, environment loading, and automatic installation.
The new config is tasks-only, with no tools, plugins, or task dependencies; preserve the original minimal `mise.toml` and provisioning installation guard unchanged.
Before trusting this config or executing the new wrapper, the parent must independently verify reviewed request/config/wrapper/shared-helper hashes; the wrapper's secondary self-check cannot substitute for that authority check.
Pass exact-selector static/synthetic unit tests, tooling TypeScript checks, and mandatory adversarial/security source gates before narrow config trust and the one real inert probe.

After an actual renewed attempt, an exit-0 receipt may set only `inertProbePassed:true`; keep `buildIsolationQualified:false`, `custodyQualified:false`, `actualCudaCompilationEstablished:false`, and `trainingReady:false`.
On failure, identify the actual failing layer from retained stderr and stop that renewed sequence before LLVM acquisition; do not retry automatically or change flags.
On success, only a full-scope renewal may continue toward the remaining pipeline, with implementation/review and actual namespace/custody tests still required before a compiler.
Never extrapolate the inert root or empty `/proc` result to the full LLVM build environment.

#### Historical trust-order source acceptance — final-2 snapshot only

All three historical final-2 receipts below record PASS, exit 0, `sourceChanged:false`, and the same trust-order source-manifest digest; they execute static/synthetic checks, not actual Mise trust/discovery or namespace operations.

| Run under `_work/gpu-owner-recovery/runs/` | Result |
|---|---|
| `cuda-isolation-order-static-final-2` | 15 tests / 255 assertions |
| `cuda-isolation-order-types-final-2` | Tooling TypeScript check PASS |
| `cuda-isolation-order-runner-final-2` | 13 tests / 89 assertions |

Preserve `cuda-isolation-order-types-1` FAIL, exit 2: its test supplied `string[]` where the fixed stage-name union array was required; the later type correction and PASS do not rewrite that result.
The final-1 15-test/251-assertion generation and initial 10-test/178-assertion source reviews remain historical, not current corrected-source acceptance.
Both final trust-order rereviews accepted their pre-alias source snapshot with no remaining findings; these verdicts do not cover the subsequent layout correction:

| Review | Session | Source-only verdict |
|---|---|---|
| Security | `ses_e4439a2c0ffeTD6G2gSAPqPEyM` | `READY_FOR_RENEWAL_REQUEST`: yes |
| Adversarial | `ses_e4439a2b6ffeD4aw7uSogI27Fg` | `READY_FOR_EXACT_RENEWAL_REQUEST`: yes |

These verdicts accept source for an exact renewal request only; they grant no actual retry, trust/query, namespace operation, download, installation, or compilation.
The parent persisted `_work/gpu-owner-recovery/cuda-isolation-corrected-source-review.json` with status `NONRUNNABLE_SOURCE_ACCEPTANCE_FOR_RENEWAL_REQUEST_ONLY`, final-2 receipt links, reviewer sessions, and source hashes.
`_work/gpu-owner-recovery/runs/cuda-isolation-renewal-records-1/receipt.json` records historical PASS with `sourceChanged:false`, validating full final-2 manifests against the retained `request-before.json` verification snapshot, raw streams/counts, implementation hashes at that checkpoint, and the then-current request's `SOURCE_CORRECTION_REVIEW_METADATA_ONLY` delta; it does not validate the later renewal or alias source/request generation.
Preserve `_work/gpu-owner-recovery/cuda-isolation-reviewed.json`; the first-attempt receipt pins its SHA-256 as `094327f153dd33d59aaa4127fdf91733ae932a36ccfcafb944ff92cbe82fd849`.

#### Renewed attempt 2 — trust/discovery passed, native layout rejected

Executor selected `Renew full scope (Recommended)` with the same two-artifact, gated-provisioning, two-no-run-target scope and first-failure stop.
The parent preserved `runs/cuda-isolation-probe-2/request-before-renewal.json` under `_work/gpu-owner-recovery/`, SHA-256 `51c1e8f3436dfae1c2040b8e33788784050f2718d7dba5164bbfe0464a3481f8`.
The renewed request hash was `28356e2dd638956c800ea275173a6664ebd71bf6ae067e10bb4e51685c65ad10`.
`runs/cuda-isolation-layout-records-1/approved-request-reconstructed.json` preserves bytes reconstructed from the prior halted snapshot and matched to that actual attempt pin; it is not an original approval-time capture and supplies no new authority.
Fresh `cuda-isolation-renewed-static-1` passed 15 tests / 255 assertions, `cuda-isolation-renewed-types-1` passed types, and `cuda-isolation-renewed-runner-1` passed 13 tests / 89 assertions; each receipt records `sourceChanged:false` and the renewed generation's manifest.
Only after fresh approval and accepted source did the parent create `_work/gpu-owner-recovery/cuda-isolation-reviewed-v2.json`, SHA-256 `96558dad450d33eca000c12e7ecce4ccec094d7cdeec05401e7c90a2ab248412`.
Preserve both fixed v1/v2 records as historical bindings; never overwrite either or treat v2 as acceptance of alias code.

`runs/cuda-isolation-probe-2/receipt.json` records one actual renewed attempt, FAIL exit 1, `sourceChanged:false`, under the existing outside 30-second `runBounded` deadline with pinned source/request checks before imports or Mise.
The reviewed `runMiseStages` consumer passed `00-trust` for the exact leaf and `01-config` for sole-config discovery; `02-inert-probe` failed with `UNSUPPORTED_TRUSTED_FILE_LAYOUT` before `Bun.spawn` could invoke bwrap.
Preserve this second receipt and stdout/stderr unchanged; `cuda-isolation-probe-2-classification.json` records the failing wrapper predicate, not a failed namespace syscall.
The parent halted that renewal at its first actual failure; this halt lasted until the next explicit layout renewal and did not renew itself.
Both attempts leave `namespaceCommandAttempted:false` and `namespaceSupportDetermined:false`; neither establishes unsupported kernel namespaces or a required host-only command.

#### Accepted exact-alias isolation source — pre-continuation snapshot

`runs/cuda-isolation-layout-metadata-1/receipt.json` records read-only diagnosis PASS without invoking Mise, a namespace, or native executables.
Its stdout authenticates guest `/usr/bin/true` resolving to physical `/usr/bin/gnutrue`: a root-owned regular file, mode `0755`, 35,288 bytes, SHA-256 `7d659da07aad1d5d1ed79e9f2822d24d2dea47ceec4c7e2e71718a177dc20b4b`.
That identity matches pre-attempt `readiness-native-build-environment.json`; the old physical-path-equals-guest predicate rejected an already recorded layout rather than discovering a new kernel limitation.

Architect approved an exact source-only alias correction without requiring permission merely to develop the fix.
Shared `physicalPathAllowed` in `readProbeFiles` and `validateProbeFiles` accepts only `/usr/bin/true` or `/usr/bin/gnutrue` as the physical source for fixed guest `/usr/bin/true`.
Do not search PATH, choose a fallback command, or admit arbitrary paths under `/usr`.
Retain regular-file, root-owner, size, mode, hash, and before/after FD-read consistency checks; library handling remains unchanged.
Only the read-only bind source operand may change; the guest command, all other bwrap arguments, private dev/empty proc, namespaces, outside pin gate, and supervisor remain unchanged.
Validation reads through an FD and closes it before bwrap binds the pathname under C1; this is not an atomic held-FD mount or a new custody guarantee.

These accepted isolation-only receipts share manifest SHA-256 `3fa56c30a4b0a7168b44a62c76a15d8caaad6147022c6d564730d09e75dc94ee`, record PASS and `sourceChanged:false`, and establish these bounded results, not acceptance of later continuation/acquisition code:

| Run under `_work/gpu-owner-recovery/runs/` | Result |
|---|---|
| `cuda-isolation-layout-static-1` | 16 tests / 276 assertions |
| `cuda-isolation-layout-types-1` | Tooling TypeScript check PASS |
| `cuda-isolation-layout-runner-1` | 13 tests / 89 assertions |

Tests cover the captured alias with exactly one bind-source operand changed, negative paths/modes/UID/size/hash, and a matching-hash halted grant that stops before `readProbeFiles` or spawn.
All three read-only source reviews return `READY_FOR_EXACT_LAYOUT_RENEWAL_REQUEST`: yes, with no findings:

| Review | Session |
|---|---|
| Security | `ses_e4439a2c0ffeTD6G2gSAPqPEyM` |
| Adversarial | `ses_e4439a2b6ffeD4aw7uSogI27Fg` |
| DevOps | `ses_e44a58336ffePB4MyFlISk7KQC` |

The parent persisted `cuda-isolation-layout-source-review.json` as `NONRUNNABLE_SOURCE_ACCEPTANCE_FOR_EXACT_LAYOUT_RENEWAL_REQUEST_ONLY`, with nine implementation hashes, these receipt links, and the at-verification request/before-record snapshot.
`runs/cuda-isolation-layout-records-1/receipt.json` records pre-renewal PASS with `sourceChanged:false`, validating its full source/manifest snapshots, raw streams and 16/276 plus 13/89/type results, implementation hashes at that checkpoint, and the then-current request's `NATIVE_LAYOUT_REVIEW_METADATA_ONLY` delta.
This historical evidence validation did not rerun source tests against later request metadata; at that checkpoint it confirmed both failures/v1/v2 unchanged, v3 and LLVM cache files absent, authority halted, namespace support undetermined, and `trainingReady:false`.
The parent reports final read-only adversarial record review by session `ses_e4439a2b6ffeD4aw7uSogI27Fg` covering that pre-renewal layout-source acceptance, request, closure, classification, and `cuda-isolation-layout-records-1` evidence.
It reports no findings and `READY_TO_ASK_EXACT_LAYOUT_RENEWAL`: yes; this records-only verdict changes neither source nor execution authority.
Historical `cuda-isolation-corrected-source-review.json` accepts only the trust-order generation, not this alias source.
The next explicit renewal created fixed v3 as recorded below; neither a source-only acceptance record nor that predecessor binding accepts new acquisition code.
At that isolation-source checkpoint no LLVM archive/sidecar was cached or downloaded; the later acquisition below does not rewrite its scope or establish native execution.

#### Historical attempt 3 — inert PASS before the later root-plan halt

Executor again selected `Renew full scope (Recommended)` after exact-layout source acceptance, preserving the same artifacts, limits, exclusions, and first-failure rule.
`runs/cuda-isolation-probe-3/request-before-renewal.json` retains the prior halted request, SHA-256 `ad2134c4d60991491eb6b285b000dbeafb89e542c42fdd2ee9b6f5fa277ddda1`.
Fresh `cuda-isolation-layout-renew-static-1`, `cuda-isolation-layout-renew-runner-1`, and `cuda-isolation-layout-renew-types-1` record PASS, 16 tests / 276 assertions, 13 tests / 89 assertions, and types respectively, all `sourceChanged:false` in their renewal snapshot.
Only after explicit renewal and accepted source did the parent create fixed `cuda-isolation-reviewed-v3.json`, SHA-256 `509d75b8bdda611f8059307368a043130b34a75179cb72c31ae3ba28a8257f94`.
Before execution, the parent saved original raw approved-request bytes in `runs/cuda-isolation-probe-3/approved-request.json`, SHA-256 `2882f02baf9054e1890d58f4c984d3adc49fbbf0fad2ee5359312759a17a64c5`; unlike attempt 2's later reconstruction, this is an original capture.
Preserve v1/v2 and both failed attempts unchanged; v3 authenticates the completed isolation generation, not new continuation/acquisition source or a changed verification helper.

`runs/cuda-isolation-probe-3/receipt.json` records exactly one actual PASS, exit 0, `sourceChanged:false`, under the existing outside 30-second `runBounded` deadline with request/review/source pins checked before new imports or Mise.
Reviewed `runMiseStages` completed exact-leaf trust, sole-config discovery, and bwrap's required user/network namespaces without changed flags, then ran fixed guest `/usr/bin/true` with validated physical `/usr/bin/gnutrue`.
Retained stdout includes the validated native file metadata and `inertProbePassed:true`; the classification records `namespaceCommandAttempted:true` and `inertNamespaceLaunchEstablished:true`.
This establishes an inert namespace launch only: full-build isolation, custody, CUDA compilation, and training readiness remain false.
That inert invocation downloaded, installed, and executed no LLVM file and ran no compiler/GPU operation; the renewal subsequently acquired the two inputs below without an actual failure.
At that checkpoint full scope remained active through exact acquisition; the later read-only root-plan failure below halted the remaining sequence without rewriting this inert PASS.

The parent added a closed `cuda-isolation` verification stage with an exact test selector and selector-membership coverage in `verify.test.ts`.
Tool-stage manifests include `_work/gpu-owner-recovery/*.ts`, `*.toml`, and `cuda-llvm-request.json`; subsequent receipts must bind their new generation rather than rewriting old closing snapshots.
The parent also added closed `cuda-acquire` verification with two exact test selectors and new tool/proof-manifest membership regressions; the changed verification helper belongs to a new generation, not v3's current-source claim.
The accepted application/owner source and disabled normal GPU mains remain frozen; the new development tool has no inherited source-review verdict.
The index remains a partial 10/5/3-edge legacy projection, not complete coverage or a claim that the indexed GPU-owner concern covers this new tool.

#### Completed exact acquisition — executed snapshot, not installation

The acquisition slice passed its own source gates before fetching either file; its accepted snapshot contains no unpacking, installation, LLVM execution, or CUDA/compile path.
`cuda-acquire-static-parent-3` passed 28 tests / 520 assertions, `cuda-acquire-types-parent-3` passed types, `cuda-acquire-runner-parent-3` passed 14 tests / 142 assertions, and `cuda-acquire-isolation-regression-3` passed 16 tests / 276 assertions, all `sourceChanged:false`.
Preserve `cuda-acquire-types-parent-2` FAIL: locked Bun types reject the unnecessary `proxy:false` option; removing that option did not replace the real strict proxy-variable rejection and complete private-environment guard.
The source uses manual credential-free GET with identity encoding and `decompress:false`; unsupported option syntax is not evidence of transport isolation.
The receipt-commit HIGH correction requires write, sync, and close to succeed before an exclusive PASS link becomes consumable; a provisional or failed verdict write must not advertise success.
The accepted manifest includes root `tsconfig.json`; this closes source/type-input accounting without claiming all-source qualification or filesystem durability.
Security and adversarial source reviews returned `READY_FOR_EXACT_TWO_FILE_ACQUISITION_CONDITIONAL_ON_OUTSIDE_PIN_AND_DEADLINES`, with no remaining findings.

`cuda-acquire-reviewed.json` has SHA-256 `7e163891ae6e9cde0a77ea2608d5c25129add3edbfda078ee2c2619be3850f3f`; the original approved-request capture has SHA-256 `6b8aae0c45ac959e555675c3f5a7908968fb999b55d16daba833c81fca5cb346`.
Before fetching, the parent retained these bytes as `runs/cuda-llvm-acquire-1/source-review.json` and `approved-request.json` and pinned 15 source files plus six predecessor proofs before new imports or Mise.
Each artifact used one existing outside 120-second `runBounded` invocation: exact new leaf trust → sole-config discovery → fixed artifact task; the archive's outside PASS was required before checksums started.
Both `runs/cuda-llvm-acquire-1/archive/receipt.json` and `checksums/receipt.json` record PASS, exit 0, `sourceChanged:false`; each child `artifact.json` records verified exact bytes/hash and exclusive cache publication.
The aggregate `runs/cuda-llvm-acquire-1/receipt.json` records PASS, with independent full cached-byte hashes and checksum-sidecar consistency matching the pinned archive, sidecar, and publisher content identities.
Both newly placed cache files are regular `0400` files; their presence/mode is not installation, strong immutability, durable storage, or full compiler qualification.

Before later edits, the parent preserved every one of the 15 actually executed source files as `runs/cuda-llvm-acquire-1/source-snapshot/00.source` through `14.source`, indexed by original path/byte length/hash in `source-snapshot.json`.
The `.source` suffix prevents Bun test discovery from executing these historical byte snapshots.
`cuda-acquire-review-provenance.json` and its `actualAcquisitionPerformed:false` describe pre-operation source acceptance; the acquisition aggregate, not that historical flag, records the actual result.
Old v3/probe 1/2/3 records retain their original scopes; none proves acceptance of later audit code or current mutable helpers.

#### Post-acquisition phase tests — distinct source generation, no replay

After request phase/result advancement, the old acquisition validator must reject that phase and consumed operation records; an active remaining grant does not authorize another acquisition invocation.
Positive continuation fixtures now derive from the immutable captured inert-approved request plus explicit known acquisition-phase fields, not an assumption that the live request remains forever in that phase.
Explicit advanced-phase/result negatives prove rejection; no actual acquisition replay occurred.
`cuda-acquire-postphase-regression-1`, `cuda-acquire-postphase-types-1`, `cuda-acquire-postphase-runner-1`, and `cuda-acquire-postphase-isolation-1` record PASS with `sourceChanged:false`: 28/522, types, 14/142, and 16/276 respectively.
Their test-maintenance generation does not rewrite the pre-execution review binding or the 15 executed-source snapshots and did not accept the then-under-construction auditor.

#### Retained acquisition guards — phase-specific, no further fetch authority

The acquisition validator requires its exact active pre-acquisition phase/scope, unchanged artifacts/limits/denials, original approved snapshot, v3/probe-3 proof identities, and its reviewed implementation/config/helper binding.
Reject probe-only, halted, consumed, missing, or stale grants; v3 is predecessor proof only, never acceptance of the new code.
The completed immutable acquisition binding authenticated only that executed source generation; the outside pin/trust/discovery/task order remains required for each separately reviewed future phase.

Keep request `taskConfiguration` unchanged; `acquisitionTaskConfiguration` selects only `_work/gpu-owner-recovery/cuda-acquire-mise.toml` through the complete private environment's filename override.
That separate tasks-only config exposes exactly two fixed-artifact Bun commands, with no new tools, hooks, plugins, environment templates, task dependencies, root trust, or automatic installation.
The original minimal tool config and provisioning installation guard remain unchanged.

Acquisition completed before full-build-root implementation and performed no unpacking, LLVM installation/execution, or compilation.
Each invocation selects one fixed artifact ID under one existing outside `runBounded` 120-second whole-invocation deadline, without a new supervisor, nested timer, or retry.
Use manual HTTPS redirects, at most three, only through `github.com` and `release-assets.githubusercontent.com`; use no credentials or ambient proxy authority, and retain no sensitive query URLs/error text in evidence.
Enforce the exact byte cap/length/hash before exclusive repository-cache publication, never overwrite conflicting bytes, and verify existing cache files as regular files with matching full bytes.
Retain only bounded partial bytes in repository-owned ignored scratch; exclusive owned operation records must reject duplicates/replay.
Any unexpected actual failure halts the entire remaining grant; expected negative pure/synthetic tests do not trigger that rule.

#### Original passive auditor source accepted — historical binding, no actual audit

At the source-acceptance checkpoint, the full grant allowed preparation for one passive audit; the later root-plan failure halted that generation before Executor's selected capture renewal below.
Under `_work/gpu-owner-recovery/`, all seven files are implemented: pure `cuda-tar.ts`/`cuda-tar.test.ts`, pure `cuda-elf.ts`/`cuda-elf.test.ts`, and `cuda-archive.ts`/`cuda-archive.test.ts` plus single-task `cuda-archive-mise.toml`.
Closed `cuda-archive` verification uses three exact test selectors and source/proof/fixture membership, including live `cuda-acquire-reviewed.json` as a required predecessor and a membership regression so that proof cannot sit outside the fingerprint.
The new literal request field `archiveAuditTaskConfiguration` selects only `_work/gpu-owner-recovery/cuda-archive-mise.toml`; preserve old configurations and their source generations except the separately identified test maintenance.
No acquisition binding or v3 predecessor binding accepts the new auditor; its own source acceptance below does not establish actual audit success or surviving retry authority.

##### Final accepted source snapshot

All five receipts below record PASS, exit 0, `sourceChanged:false`, and the same 107-input verification manifest SHA-256 `6739da3d28292c4bc0b644e912f842724306aa64e36b6e444569bd63f87f9855`:

| Run under `_work/gpu-owner-recovery/runs/` | Source/static result |
|---|---|
| `cuda-archive-static-parent-4` | 159 tests / 713 assertions |
| `cuda-archive-types-parent-4` | Tooling TypeScript PASS |
| `cuda-archive-runner-parent-4` | 15 tests / 216 assertions |
| `cuda-archive-acquire-regression-4` | 28 tests / 522 assertions |
| `cuda-archive-isolation-regression-4` | 16 tests / 276 assertions |

Preserve earlier failed receipts; the latest type corrections changed the `fail` function declaration and payload annotation without relaxing policy.
Security session `ses_e4439a2c0ffeTD6G2gSAPqPEyM`, adversarial session `ses_e4439a2b6ffeD4aw7uSogI27Fg`, and DevOps session `ses_e44a58336ffePB4MyFlISk7KQC` each returned `READY_FOR_SINGLE_PASSIVE_ARCHIVE_AUDIT`: yes, with no findings, source only.
The parent created fixed `cuda-archive-reviewed.json`, SHA-256 `e5d24c1d29be99e5989d0eddde26b94077b786e770b7338815a7ecd5d3cd453a`, and `cuda-archive-review-provenance.json` with pre-operation `actualAuditPerformed:false`.
The binding covers 23 source/config/test/fixture files, including the logical JSON fixture, and 36 predecessor proofs; these are distinct from the 107-input verification manifest.

Before importing the planner, the independent outside gate matched the raw binding, authorized request SHA-256 `27ee06aafbbc64eb936f5ea39d03ba0bdecd0b9109e8c3472ee4999d917b6321`, all 23 files, and all 36 predecessor proofs.
The parent then ran only the read-only native-root planner under the existing 30-second envelope; the failure below prevented reaching raw-config trust/discovery or the audit task.
The binding remains immutable history for the old `27ee06…b6321` request, not this new renewal; source acceptance and old request copies cannot authorize new capture/private-bind audit code.

##### Historical read-only root-plan failure and provenance limits

`runs/cuda-archive-plan-1/receipt.json` is immutable FAIL, exit 1, empty stdout, with retained stderr `UNTRUSTED_FILE_ANCESTOR` from Bun validation during `readArchiveContinuationInputs` → validation → `prepareArchiveAuditPlan`/argv planning.
The planner Bun command actually ran; no quarantine Bun child, bwrap, XZ, Mise, decompression, extraction, installation, native LLVM, compiler, or GPU launch occurred.
Its zero native-child counter does not mean no bootstrap Bun code executed; the native closure/argv plan is incomplete, not qualified.
`cuda-archive-plan-1-classification.json` records a correct accepted-policy rejection and conservative first real environment-qualification failure halt, not a native archive attempt or unsupported kernel/GPU/host-only verification command.

`runs/cuda-archive-plan-1/ancestor-metadata.json` records current UID 1000 and canonical `/usr/local/bin` UID/GID 1001, directory mode `0755`; `/`, `/usr`, and `/usr/local` are UID 0 directories, mode `0755`.
The guard permits only root/current UID for every ancestor, so the UID-1001 directory fails even though `/usr/local/bin/bun` itself is root-owned, regular `0755`, and 80,761,952 bytes.
The prior pinned Bun SHA-256 is `33d56b070be6a9e3da0ab013038b43d1645d0534ca811ecdba4472599117eb4b`; another path hash cannot remove the directory owner's ability to replace an entry before C1 pathname binding.
At that failed-plan checkpoint, no whitelist/guard change, copy, chmod/chown, retry, or new tool had occurred.

Only after the failed planning invocation did the parent retain `runs/cuda-archive-plan-1/authenticated-request-retained-after-plan.json`, matching the pre-execution request pin, and `source-review.json`, matching the fixed binding hash above.
These are post-plan retention, not original pre-execution captures; the earlier acquisition request `6b8aae…cb346` and inert request `2882f0…a64c5` remain original before-execution captures in their own runs.
The parent retained all 23 accepted-source files in `runs/cuda-archive-plan-1/source-snapshot/00.source` through `22.source`, indexed by `source-snapshot.json`, with capture timing `AFTER_FAILED_READ_ONLY_PLAN_MATCHES_ACCEPTED_PRE_EXECUTION_BINDING`.
`runs/cuda-archive-halt-records-1/receipt.json` records historical PASS with `sourceChanged:false`, validating that checkpoint's unchanged-scope HALT delta, 23 implementation/36 proof identities, and five source-gate manifests/raw streams against retained `27ee06…b6321`, not testing the later renewal or capture source.
This record-only validation preserves failed-plan bytes and the UID-1001 diagnosis, confirms no audit output/scratch was created, and supplies no retry, actual audit, or new qualification result.
The parent reports final read-only security session `ses_e4439a2c0ffeTD6G2gSAPqPEyM` and adversarial session `ses_e4439a2b6ffeD4aw7uSogI27Fg` each returned `READY_TO_ASK_NATIVE_ANCESTOR_TRUST_DECISION`: yes, with no findings.
Those verdicts cover records, exclude in-progress documentation, and themselves authorize no remedy; the later explicit selection below is the new authorization source.
That halt remains recorded in historical failure/source-correction fields; their `actualRetryAuthorized:false` values neither authorize replay of old probes nor replace validation of the new capture-specific phase.

##### Historical four-choice offer — private snapshot subsequently selected

The following offer is retained as decision history; Executor subsequently selected `Private Bun snapshot (Recommended)` only, not operator repair, a general ancestor exception, or keeping the new scope halted:

| Choice | Exact scope and retained limit |
|---|---|
| Private byte-identical Bun snapshot (Recommended) | Explicitly authorize one local capture of the known 80,761,952-byte/hash-bound Bun through a held read-only FD under the UID-1001 ancestor exception, with before/after identity checks, exclusive write/sync/close, destination verification, and a regular final `0500` file inside a private `0700` directory with validated root/current-owned ancestors. Change only the audit read-only bind source; keep guest `/usr/local/bin/bun` and the compiler/download identities unchanged. |
| Operator supplies compliant coding-realm Bun | Operator provides compliant placement or ownership repair; grant no agent sudo/chown and infer no host-GPU requirement. Authenticate the resulting exact source before new review/binding and renewal. |
| Accept the exact ancestor under C1 | Explicitly accept only canonical `/usr/local/bin`, UID 1001, mode `0755`, and its owner-replacement race between hash and pathname bind; create no broad UID-1001 whitelist. Require new source/review/binding and renewal. |
| Keep halted | Grant no remedy, trust exception, retry, or remaining execution authority. |

The selected snapshot mitigates only the audit guest bind source and explicitly retains the existing outer Bun/Mise C1 bootstrap assumption; guest-only relocation does not authenticate those launcher starts or retroactively repair their trust.
Executor's actual choice renewed the remaining approved pipeline through fresh source/verification/review and immutable-binding gates until the later actual audit failure halted it.
That historical selection granted no replay of completed acquisition or additional NVIDIA/libdevice/GNU/compiler fallback, download, image/host-GPU, training, or publication scope.

##### Completed selected capture — capture-time bytes, not runtime qualification

Before updating authority, the parent retained `runs/cuda-bun-snapshot-1/request-before-renewal.json`, SHA-256 `51d56812426992f2ad9e85980a35630fe620220a5fb562d7af20b009e1c3eb82`.
The request's literal `nativeBunSnapshotRenewal` and `nativeBunSnapshot` fields authorized one exact local capture; that copy grant remains `CONSUMED_SUCCESS`, and completed copy/downloads may not repeat.
Remaining pipeline authority stayed active at this checkpoint but was revoked after the later actual private-Bun audit failure.
The exact source is `/usr/local/bin/bun`, 80,761,952 bytes, SHA-256 `33d56b070be6a9e3da0ab013038b43d1645d0534ca811ecdba4472599117eb4b`; destination is `_work/gpu-owner-recovery/cache/native-audit-bun-1/bun`, inside an exclusively new `0700` directory, final regular-file mode `0500`.
The only source-read exception is canonical `/usr/local/bin`, UID/GID 1001, mode `0755`, for this pinned-byte capture; every other ancestor remains root/current-owned, nonwritable by other principals, and nonsymlink.
This is not permission to trust that directory for executable binding, library resolution, PATH, or a broad UID whitelist.

The three capture files were implemented and accepted before invocation; the parent retained `cuda-bun-snapshot-static-parent-1` FAIL with module-setup `SNAPSHOT_INPUT_CHANGED` during parallel run-directory creation.
Serialized `cuda-bun-snapshot-static-parent-2` passed without code change; this source-check failure did not execute a capture or consume the renewed sequence's first actual-failure condition.
All six selected source receipts below record PASS, `sourceChanged:false`, and the same 143-input manifest SHA-256 `0661a9478a2942281a101983040fa50188db1601bcc6246b850ccd9e34b376b9`:

| Run under `_work/gpu-owner-recovery/runs/` | Source/static result |
|---|---|
| `cuda-bun-snapshot-static-parent-2` | 32 tests / 717 assertions |
| `cuda-bun-snapshot-types-parent-1` | Tooling TypeScript PASS |
| `cuda-bun-snapshot-runner-parent-1` | 16 tests / 278 assertions |
| `cuda-bun-snapshot-archive-regression-1` | 159 tests / 713 assertions |
| `cuda-bun-snapshot-acquire-regression-1` | 28 tests / 522 assertions |
| `cuda-bun-snapshot-isolation-regression-1` | 16 tests / 276 assertions |

Security `ses_e4439a2c0ffeTD6G2gSAPqPEyM`, adversarial `ses_e4439a2b6ffeD4aw7uSogI27Fg`, and DevOps `ses_e44a58336ffePB4MyFlISk7KQC` each returned `READY_FOR_SINGLE_PINNED_BUN_CAPTURE`: yes, source only.
The parent added closed `cuda-bun-snapshot` verification with one exact selector and tool-manifest membership for the old 23-source packet/review, failed plan/halt streams, and captured original halted request; those are proof inputs, not permission to execute old sources.
The pure transition validator must authenticate the old halted `51d568…3eb82` request and pre-halt `27ee06…b6321`/`e5d24c…453a` packet, proof hashes, and saved `.source` bytes rather than substituting mutable current-file hashes for historical evidence.
The capture module must not import the archive module; the completed archive-v2 reuses pure validators without a dependency cycle.

Capture only through a no-follow/nonblocking held FD for the exact root-owned regular `0755` source; enforce exact size, streamed byte cap/hash, and stable source FD/path/ancestor identities before and after reading.
Source close must succeed before publication; authentication comes from the accepted byte identity, not treating UID 1001 as trusted code ancestry.
For owned staged bytes require write → sync → fchmod `0500` → sync → close → fresh stage hash → exclusive final hardlink → fresh final mode/hash verification.
Only then may the PASS receipt stage complete write/sync/close and exclusive publication as the last action; no preliminary PASS may become consumable.
Claim only an exclusive `.operation` within the outside-created `0700` receipt root; require a fresh exclusive attempt directory and fail on any existing destination/attempt state, with no overwrite, reuse, cleanup, or automatic retry.
Retain bounded partial bytes; file fsync is not directory crash-durability proof, and a private `0500` path under C1 is not strong immutability.

The parent created fixed `cuda-bun-snapshot-reviewed.json`, raw SHA-256 `780a907710d5a934c5f02414db2bedfb91d56d7cc97fd6badf6015bfcf8f58ce`, covering 18 current files and 69 historical proofs with approved request SHA-256 `e4a2dca4aa4f0cd9b463f40400912299f16765339723f1a6b371cb11da03150a`.
Before invocation it saved original `runs/cuda-bun-snapshot-1/approved-request.json`, `source-review.json`, and all 18 source files as `source-snapshot/00.source` through `17.source`, indexed with capture timing `BEFORE_ACTUAL_CAPTURE_INVOCATION`.
The outside gate independently matched those pins before imports/Mise; exact-leaf trust → sole-config discovery → fixed capture task ran once under one existing outside 30-second `runBounded` whole invocation.
`runs/cuda-bun-snapshot-1/receipt.json` records actual PASS, exit 0, `sourceChanged:false`; `capture.json` records committed capture PASS and the exclusive `.operation` prevents replay.
The independent `verification.json` PASS authenticates outer/raw-stream pins, child flags/source before-after identity, original pre-invocation source packet, and fresh held-FD full-byte hash/mode/owner/ancestor checks of the destination.
The destination is UID 1000, regular `0500` in a private `0700` directory with validated root/current-owned ancestors, with the owned pending hardlink sharing its device/inode and link count 2; original root-owned regular `0755` Bun remains unchanged.
At the capture checkpoint, the private snapshot had not executed and no actual audit/XZ/decompression/extraction/LLVM/compiler/GPU operation had occurred; the later audit establishes private execution without establishing XZ launch or decompression.
`cuda-bun-snapshot-review-provenance.json` with pre-operation `actualCapturePerformed:false` remains source-acceptance history, not current run status; the completed binding authenticates its saved executed generation, not later pure-helper additions or the post-capture request.
Capture verification corroborates historical bytes/provenance only, not fresh root/custody qualification, strong immutability, directory crash durability, or atomic mounting; outer Bun/Mise bootstrap trust remains explicitly retained.
The retained `nativeBunSnapshotResult` links PASS outside/capture/verification/source packets and records capture-time `privateSnapshotExecuted:false`; that historical flag is not a current global assertion after audit-2.
Neither the earlier active continuation nor the now-halted request authorizes recapture.

##### Completed archive-v2 source — pure capture proof and private-only routing

Architect session `ses_e44a8dd59ffeY3WhDkxuWCCTCJ` approved the proof-specific continuation plan while the remaining full scope was active; that historical approval supplies no authority after the later abort.
The formerly pending four-file slice is complete: pure additions to `cuda-bun-snapshot.ts` and its test, plus archive-v2 logic/tests in `cuda-archive.ts` and its test.
Capture-engine code, the filesystem adapter, Mise config, TAR/ELF parsers, and supervisor remain unchanged; the fresh serial source gates, three accepted reviews, and executed v2 binding are recorded below.
Verifier manifests now include the capture binding, actual streams/marker/source packet, and explicit membership checks; do not substitute live helper hashes for the 18 historically executed source bytes.

Pure `validateSnapshotReceipt(data97)` authenticates all 97 proof keys: saved approved `e4a2dc…3150a`, raw binding/copy `780a90…f58ce`, 18 saved source files, 69 historical packet proofs, outer PASS/deadline/maps, operation marker, raw streams, and strict child flags/stat identities.
Validate the exact historical UID-1001 read-source exception and the owned publication's same-inode link transition 1 → 2, permitting only its expected ctime transition; do not turn that into relaxed current native-file validation.
Treat `verification.json` as historical corroboration only, never fresh runtime root proof, and never execute saved `.source` files.
Pure `postSnapshotRequest` derives the exact approved post-capture tree from saved raw capture-approved `e4a2dc…3150a` by only four progress changes: `status`, `phase`, `nativeBunSnapshot.grantStatus` to `CONSUMED_SUCCESS`, and fixed literal `nativeBunSnapshotResult`.
That projection does not describe the later halted request; the old pending-capture predicate still rejects the advanced post-capture phase, and pure proof consumption cannot invoke another copy.
Archive-v2 still authenticates original acquisition `6b8aae…cb346`/`7e1638…50f3f`, its saved 15-source packet and inert proofs, without executing those historical sources.

The parent created fixed `cuda-archive-reviewed-v2.json` with only the distinct `.v2` schema, 26 current source files, and 97 predecessor proofs after fresh unit/types/security/adversarial/DevOps acceptance.
The outside gate independently pinned its raw binding, approved request, all 26 sources, and all 97 proofs before new operational imports/Mise; old capture/first-audit bindings remain predecessor proof only.
For logical guest `/usr/local/bin/bun`, branch before any `realpath` or other original-source filesystem lookup and route only to `_work/gpu-owner-recovery/cache/native-audit-bun-1/bun`.
Missing/corrupt private bytes must fail without original-source lookup or fallback; freshly require UID 1000, regular `0500`, known size/hash, canonical root/current-owned ancestors, immediate private `0700`, and stable reads before/after revalidation.
Keep `trustedAncestors` unchanged for executable binding, XZ, and libraries; UID 1001 appears only in historical capture-read proof data.

The actual attempt used fresh `scratch/cuda-archive-audit-2` and `runs/cuda-archive-audit-2` under the work root; old audit 1 was never launched and old plan 1 remains only read-only failure evidence.
Exactly two bwrap source operands changed: private Bun source and fresh output-scratch source; all guest destinations, environment, commands, flags, two system library roots/interpreter aliases, private read-only dev, empty proc, root read-only, and scratch-only writable policy remain unchanged.
No PID/new-session/network fallback or parser/cap relaxation is authorized.
After the new source/binding gates, fresh private-root read-only qualification passed before the one actual passive audit under the existing outside 30-second anchor; full build-root/custody/GNU ABI/install/compiler gates remain later and unqualified.
Capture PASS remains intermediate, not terminal readiness; the subsequent unexpected actual audit failure halted the entire remaining scope without recapture or completed-download replay.

##### Fresh serial archive-v2 source gates and pre-operation binding

All six fresh serial receipts below record PASS, exit 0, `sourceChanged:false`, and the same 180-input manifest SHA-256 `f7d3bed722df485aa5e82081ef85ebb2fcfb19511ef29b876d8ccb14073d2446`:

| Run under `_work/gpu-owner-recovery/runs/` | Source/static result |
|---|---|
| `cuda-archive-v2-snapshot-parent-2` | 46 tests / 1,065 assertions |
| `cuda-archive-v2-static-parent-2` | 163 tests / 842 assertions |
| `cuda-archive-v2-types-parent-2` | Tooling TypeScript PASS |
| `cuda-archive-v2-runner-parent-2` | 16 tests / 326 assertions |
| `cuda-archive-v2-acquire-regression-2` | 28 tests / 522 assertions |
| `cuda-archive-v2-isolation-regression-2` | 16 tests / 276 assertions |

Preserve earlier `cuda-archive-v2-types-parent-1` FAIL and its raw streams; the correction reversed only a test's generic `expect` direction for the Record type, not source behavior.
The 180-input verification manifest is distinct from the binding's 26 current source files and 97 predecessor proofs.
All three read-only source reviewers returned `READY_FOR_SINGLE_PRIVATE_BUN_PASSIVE_ARCHIVE_AUDIT`: yes, with no findings:

| Review | Session |
|---|---|
| Security | `ses_e4439a2c0ffeTD6G2gSAPqPEyM` |
| Adversarial | `ses_e4439a2b6ffeD4aw7uSogI27Fg` |
| DevOps | `ses_e44a58336ffePB4MyFlISk7KQC` |

Fixed `cuda-archive-reviewed-v2.json` has raw SHA-256 `dacf7e484328711b65f72d48ee6cba4808164fd6ce9ddb7bf3366868486f173c`; its approved request has SHA-256 `a968cc2761869c8634a3cc929f2b1d21a7804f7128bd1fb6b045f76598fbd9f1`.
`cuda-archive-review-provenance-v2.json` records pre-operation source acceptance, conditional on outside pins, planning, and the whole 30-second envelope.
Its `actualAuditPerformed:false` and `privateSnapshotExecuted:false` remain valid only for that pre-operation scope; they do not contradict the later failed execution or prove current non-execution.
Old `e5d24c…453a`/`27ee06…b6321` and `780a90…f58ce`/`e4a2dc…3150a` source packets retain their original identities, scopes, and capture timing unchanged.

##### Read-only private-root qualification — PASS, not runtime compatibility

`runs/cuda-archive-v2-plan-1/receipt.json` records read-only PASS, exit 0, `sourceChanged:false`, after independent raw binding/request/26-source/97-proof pins before new imports/Mise.
The parent captured original approved request and source-review bytes under that run before the plan.
Fresh checks fully hashed the private Bun and authenticated its captured device/inode, link count 2, regular `0500`, UID 1000, immediate private `0700` directory, normal ancestors, and full passive ELF library/loader closure.
The plan retained guest paths and strict root flags; it launched no quarantine child or private snapshot and performed no decompression.
Its `privateSnapshotExecuted:false` is plan-scoped history, not a current global statement.
Read-only plan success establishes neither Bun runtime compatibility nor successful structural audit, full build isolation, custody, GNU C++ ABI, installation, compilation, or GPU readiness.

##### Actual passive audit-2 — private Bun executed and aborted

Before the actual invocation, the parent saved original raw approved `a968cc…bd9f1` request and `dacf7e…f173c` source review under `runs/cuda-archive-audit-2/`.
It also saved all 26 actually executed source files as `source-snapshot/00.source` through `25.source`, indexed by `source-snapshot.json` with timing `BEFORE_ACTUAL_PASSIVE_AUDIT_INVOCATION`.
These are original pre-invocation bytes, unlike old plan-1's post-failure retained packet; no saved `.source` file was executed as a replacement program.

`runs/cuda-archive-audit-2/receipt.json` records exactly one actual passive-audit invocation: outside FAIL, exit 1, `sourceChanged:false`, no timeout, under one existing outside 30-second whole Mise → wrapper → bwrap → private-Bun envelope.
Exact-leaf `00-trust` and sole-config `01-config` passed; `02-audit` failed, and the raw streams remain unchanged.
Raw stderr identifies quarantine Bun 1.4.0 with fixed `-e` arguments beginning with an `auditTar` import from `/audit/cuda-tar.ts`, then reports `panic(main thread): abort() called` and `ARCHIVE_QUARANTINE_FAILED`.
Those arguments identify the intended auditor program, not proof that its imports or decoder startup completed.
Private Bun execution inside quarantine is now established; this is not merely bootstrap Bun execution or a globally unexecuted copied snapshot.
The outside exit code does not supply a separately established quarantine-child exit code.

`cuda-archive-audit-2-classification.json` records `PRIVATE_BUN_ABORT_INSIDE_MINIMAL_AUDIT_ROOT`, root cause `UNDETERMINED`, and XZ launch/decompression `UNESTABLISHED`.
Self-reported elapsed 1 ms is diagnostic text only; Bun's claim that its crash indicates a Bun bug proves neither causation nor exoneration of the code.
No `/proc/self/exe` theory, namespace incompatibility, required host-only command, or proven runtime-correcting source fix is established.
Do not infer that XZ never started, that no decompression occurred, or that no archive bytes were read; the retained evidence does not decide those questions.

No child inventory or published structural inventory exists.
`runs/cuda-archive-audit-2/output-state-after-failure.json` records read-only directory inspection with `scratchEntries:[]`; observing empty scratch is not a decoder probe or proof of no prior work.
No extraction, installation, LLVM execution, compiler invocation, or GPU operation resulted; full-build isolation, custody, GNU C++ ABI, and `trainingReady` remain unqualified/false.
Raw `command.stdout`/`command.stderr` preserve the encoded crash-report URL as opaque evidence; no URL visit, upload, external report, publication, or research occurred, and this documentation must not initiate one.

##### Preserved full-pipeline first-failure halt and bounded record validation

The parent immediately persisted `authorityGranted:false`, authorization `HALTED_AFTER_FIRST_FAILURE`, status `HALTED_AFTER_PRIVATE_BUN_ARCHIVE_AUDIT_INVOCATION_FAILURE_DECISION_REQUIRED`, phase `HALTED_AFTER_PRIVATE_BUN_ARCHIVE_AUDIT_INVOCATION_FAILURE`, and `renewedExecutorDecisionRequired:true`.
The current `archiveAuditFailure` is classified, not pending; it points to audit-2, private runtime abort, unknown cause, unestablished XZ/decompression, and absent inventory.
At that halt checkpoint, closure recorded `RUNTIME_COMPATIBILITY_DECISION_REQUIRED_AFTER_PRIVATE_BUN_QUARANTINE_ABORT`, all new authority false, `nextDecisionRequest` pointing to `cuda-llvm-request.json`, and private execution in quarantine true.
The later separate diagnostic selection changes only the new diagnostic authority; it does not renew this full request or alter the saved halt records.
Its `latestDevelopmentRun`, `activeRenewalFailure`, and corrected `latestDevelopmentFailure` point to actual audit-2; old plan-1 remains historical failure evidence.
Security's LOW stale `latestDevelopmentFailure` pointer was resolved before final record acceptance.
The executed `dacf7e…f173c` binding intentionally no longer authenticates the now-halted request; matching old approved bytes cannot supply retry authority.

At that halt-record checkpoint, all actual operations had stopped after failure; only record/data reads and writes followed, with no native probe, recapture, rerun, policy/grammar change, root/proc/PID/new-session/network change, or new tool.
`runs/cuda-archive-v2-halt-records-1/receipt.json` records bounded record-only PASS, exit 0, `sourceChanged:false`, scope `RECORD_VALIDATION_ONLY_NOT_NATIVE_PROBE_OR_ARCHIVE_RETRY`.
It validated the strict halted transition from original approved `a968cc…bd9f1` without scope/denial changes, the then-unchanged 26 source identities and all 97 proofs, and six historical source-gate manifests/raw-stream hashes.
For those historical manifests it substitutes the saved approved request, not the changed current halted request; this is evidence validation, not a current-request source-regression rerun.
It also validates original failed receipt/streams/Bun marker, all 26 pre-invocation source snapshots/timing, the preserved read-only plan PASS, empty output observation, unknown cause/XZ status, revoked authority, and current failure pointers.
Original v1, copy, and v2 proof bytes remain preserved; this record PASS establishes neither compatibility nor successful audit and renews no authority.

`cuda-archive-v2-halt-review.json` records security and adversarial `READY_TO_ASK_RUNTIME_COMPATIBILITY_DECISION`: yes, read-only, with no remaining findings.
Those verdicts accept halt records and the TUI boundaries only; they exclude these documentation edits, confer no new source approval, and authorize no execution.
That historical record preserves its checkpoint's `decisionSelected:false`, `diagnosticAuthorityGranted:false`, `additionalHelperBuildAuthorityGranted:false`, and `realArchiveRetryAuthorityGranted:false`; it does not describe the later separate diagnostic selection.
Read-only architect/security/DevOps advice identifies a genuine runtime fork, not a demonstrated corrective source fix or host-GPU verification requirement.

##### Selected synthetic diagnostics — source gates pass, runner decision required

Executor selected `Synthetic diagnostics (Recommended)`.
The existing `_work/gpu-owner-recovery/cuda-bun-compatibility-request.json` uses schema `chess-coach.cuda-bun-compatibility-request.v1`, status `APPROVED_SYNTHETIC_DIAGNOSTIC_SOURCE_GATES_PENDING`, `authorityGranted:true`, grant status `APPROVED_NOT_EXECUTED`, and phase `SYNTHETIC_DIAGNOSTIC_SOURCE_GATES_PENDING`.
Only this separate request authorizes the conditional diagnostic scope; it does not activate the full LLVM request.
Closure records `newLocalDiagnosticAuthorityGranted:true`, `diagnosticSourceStatus:STATIC_GATES_PASS_DEVOPS_HIGH_BLOCKS_BINDING_AND_EXECUTION`, `diagnosticCasesLaunched:0`, and `fullArchivePipelineAuthorityGranted:false`.
The diagnostic request remains byte-unchanged and unconsumed, pinned SHA-256 `3e2164b0fc9e1d092d519928a2e4a7b0e085cd5eccdb6ed49245d6d8a43f880a`; its literal source-gates-pending fields are not a current acceptance verdict.
All six fixture/compatibility files and the outside invoker are implemented; current static results and conditional reviews appear below, but no accepted binding or compatibility result exists.
No diagnostic native case, new Mise invocation, production native-closure preparation, native XZ compression/decompression, or real-archive read/rehash/mount has occurred in this diagnostic continuation.

Keep `_work/gpu-owner-recovery/cuda-llvm-request.json` byte-identical to the original saved copy `runs/cuda-bun-compatibility-1/llvm-request-halted.json`, pinned SHA-256 `e0b54ee82895a3da613e92e764ccd7db2c10f2001e95241543b36f49b6f1cc63`.
Its authority remains false/HALTED, its first-failure state remains intact, and its full-pipeline `implementationPrepared:false` remains unchanged.
The Rust-only auditor option was not selected; no helper compilation or additional Cargo target is authorized.
Neither the consumed capture nor completed acquisition may repeat.

###### Implemented source boundary — shared native closure, no archive payload

The parent reports architect consultation `ses_e43068215ffeuugrCoynxn0LkH` confirming extraction of existing `makeNativeClosure` logic into shared `prepareArchiveNativeClosure` with typed native files, launcher, explicit C1 label, and custody qualification false.
The shared native-only extraction in the existing `cuda-archive.ts`/test boundary is implemented and covered by the fresh archive regression below; that source verification does not establish production closure or runtime qualification.
The diagnostic consumer must perform zero `io.payload` reads and create zero real-archive payload mounts.
Do not call full `prepareArchiveAuditPlan` and filter its result: that path can read the forbidden real archive before filtering.

Use pure `validateArchiveContinuation` only against the saved 26-source audit packet, original `dacf7e…f173c` binding/`a968cc…bd9f1` request, and all 97 predecessor proofs as data.
That authenticates historical capture/continuation evidence, not mutable current source acceptance; do not compare historical source pins to live edited files or execute saved `.source` bytes.
Fresh native closure checks must independently bind the private Bun's full known identity, captured device/inode/link count, regular `0500`, UID 1000, immediate private `0700`, normal ancestors, stable FD reads, and exact loader/library closure.
Route logical Bun to private bytes before any original-Bun lookup; preserve all executable/library guards and admit no UID-1001 capture-read exception for native binding.
Retain closed-FD C1 pathname binding and custody false; a fresh closure does not establish atomic mounts, strong immutability, or full-build qualification.
The private guest copy does not secure outer Bun/Mise startup; the existing outer-bootstrap C1 assumption remains explicit.

###### Fixed fixture and one common restricted root

Prepare only source-built synthetic bytes: a 1,536-byte TAR containing the single `tracel-llvm-23.1.0-4` root-directory entry plus two zero headers, and a 1,592-byte XZ encoding using uncompressed LZMA2 and CRC32.
The fixed JSON fixture manifest is `_work/gpu-owner-recovery/fixtures/cuda-bun-compatibility.json`; require its reviewed exact identities and inventory, with zero regular-file payload bytes.
The pure fixture records TAR SHA-256 `780b54898801bb4eaa7b47da96e5c9fbb67c1a1fa0d5b423fb844659fab7175b` and XZ SHA-256 `dbe1de8b5a5e967ab6866b9cb1718c4b883f5a19ba05557261d127e802cf05de`; no native compressor or decoder ran.
Do not invoke a native compressor or acquire fixture bytes.
Fix all case programs and accepted token choices before binding; accept no free-form case program or arguments.
The following root/case/lifecycle rules remain gated requirements, not permission to prepare or launch while the source blocker is open.

All three cases must use the identical restricted, file-only root: validated private Bun, existing XZ, exact system loader/libraries, read-only pure auditor, read-only fixture JSON, and read-only `/inputs/synthetic.tar.xz`.
Prepare the source-only fixture and complete native closure inside the one suite deadline, before the first case.
Mount only the same private output directory writable; never mount the outside control/receipt root.
Keep empty `/proc`, private read-only `/dev`, root read-only, the fixed four-variable guest environment, and unchanged user/network namespaces, flags, and library roots.
Add no PID namespace, new session, network fallback, proc/device exposure, environment expansion, credentials, sockets, parent escape path, ptrace, tool, download, or Bun upgrade.
Exclude the real LLVM archive, checksum sidecar, and real input from the common root; do not read, rehash, or mount those files for diagnostics.

###### Fixed cases and predeclared classification

Run at most these three distinct cases once each, in dependency order `startup → parser → xz`:

| Case | Required compatible completion |
|---|---|
| `startup` | Import-free private Bun emits only its fixed exact startup marker; require successful launcher exit, natural stream EOF, and actual reap. |
| `parser` | Import the read-only auditor and parse the embedded fixed TAR literal; require exactly the one-entry inventory from the reviewed fixture, successful exit, EOF, and actual reap. |
| `xz` | Use only existing XZ with `--decompress --stdout --threads=1 --memlimit-decompress=256MiB -- /inputs/synthetic.tar.xz`; stream into the auditor and require the exact synthetic inventory, XZ/launcher success, EOF, and actual reaps. |

Declare the only recognized abort observation before execution: empty stdout, the exact Bun 1.4.0 build `34cbb9a40` / Linux x64 signature with `panic(main thread): abort() called`, actual nonzero bwrap-launcher status, both streams at EOF, and actual owned-process reap.
Any setup, bounds, custody, supervisor, or stream fault disqualifies that observation.
Record launcher exit/signal separately; the private Bun's exact signal remains `UNKNOWN`, not inferred from bwrap status or panic text.
`BUN_ABORT_DIAGNOSTIC_OBSERVED` never means compatibility PASS; skip dependent cases without retries, so a recognized startup abort skips parser and XZ.
Unexpected setup/custody/grant changes, deadline, bounds, stream/EOF/reap faults, or unknown output stop the suite and require a new diagnostic grant.
Drain stdout/stderr concurrently with 64 KiB caps, including outside/case evidence streams; require the fixed synthetic XZ output and all owned child exits/reaps rather than forced stream closure as fabricated EOF.

###### Implemented outside protocol — binding absent, execution blocked

The implemented protocol requires fixed `cuda-bun-compatibility-reviewed.json` with schema `chess-coach.cuda-bun-compatibility-source-review.v1`, exactly 33 current files, and exactly 140 proofs; the binding file is absent and must not be created while DevOps rejects the source.
The 33-file membership retains the prior 26 plus compatibility three, fixture three, and the outside invoker.
The 140-proof membership includes all 97 predecessors plus the saved failed-audit 26-source packet, raw receipts/streams, classifier, read-only qualification, and full halted-request snapshot; preserve every old packet/receipt byte without trimming or rewriting it.
The parent owns the outside invoker, closed verification stage, current/helper/proof-membership regressions, and independent raw request/binding/complete-current-closure pins.
Capture the complete accepted source packet only after all source/review gates and parent record-integrity checks pass, before operational imports/Mise; do not set `devopsSourceAccepted:true` or invent an accepted binding hash.
Trust only authenticated `_work/gpu-owner-recovery/cuda-bun-compatibility-mise.toml`, the single-task tasks-only leaf; retain the existing complete private Mise environment/config override and no root trust, hooks, tools, automatic installation, or task dependencies.

Retain one aggregate 30-second suite budget for outside gates → source-only fixture/native closure preparation → exact-leaf trust → sole-config discovery → the single fixed diagnostic task → all cases → stream EOF/reaps → evidence commit.
The existing `runBounded` and supervisor implementations remain frozen and unchanged; only previously approved verification selectors/manifests changed.
The 30-second budget is a required limit, not an established unconditional hard-return or descendant-termination guarantee; the cancellation finding below blocks qualification.
Do not reset that deadline per stage/case, add a nested supervisor, or renew the budget.
Claim an exclusive `.operation` only within the outside-created `0700` `runs/cuda-bun-compatibility-1` root, which already contains the halted snapshot; never recreate that root.
Create fresh exclusive private input/output directories; reject existing operation or destination state with no overwrite, reuse, cleanup, retry, or recapture.
Preserve bounded partial evidence and use owned-group termination on failure without losing the existing supervisor's custody/EOF/reap requirements.
Publish consumable evidence only after write/sync/close and exclusive publication as the last action; publish no preliminary PASS.

###### Fresh serial source gates — PASS, not operational acceptance

All seven `runs/cuda-bun-compat-*-parent-2/receipt.json` records below report PASS, exit 0, `sourceChanged:false`, and the same 242-input manifest SHA-256 `d8d5bc5fcebd95d9163bbc13e53af1abf55d611dfe7ae11e7a87d18af39925f8`.
The completed leaf-only record check below authenticates this generation's complete manifests/current input hashes and raw streams; it does not qualify runner cancellation or diagnostics.

| Run under `_work/gpu-owner-recovery/runs/` | Source/static result |
|---|---|
| `cuda-bun-compat-static-parent-2` | 23 tests / 4,161 assertions |
| `cuda-bun-compat-types-parent-2` | Tooling TypeScript PASS |
| `cuda-bun-compat-archive-parent-2` | 164 tests / 870 assertions |
| `cuda-bun-compat-snapshot-parent-2` | 46 tests / 1,065 assertions |
| `cuda-bun-compat-runner-parent-2` | 18 tests / 476 assertions |
| `cuda-bun-compat-acquire-parent-2` | 28 tests / 522 assertions |
| `cuda-bun-compat-isolation-parent-2` | 16 tests / 276 assertions |

Preserve `cuda-bun-compat-types-parent-1` FAIL, exit 2, and its raw streams: corrections addressed number-literal defaults and readonly Bun `expect` types before the serial seven-gate generation.
The earlier static-parent-1 PASS remains an older source generation, not acceptance of the current corrected files.

`runs/cuda-bun-compat-review-blocker-1/receipt.json` records PASS, exit 0, scope `LEAF_READ_ONLY_JSON_HASH_CHECK_NO_SUBPROCESS_DESCENDANTS_NOT_A_DIAGNOSTIC_INVOCATION`.
Its retained `command.stdout` confirms all seven PASS/counts above, the same 242-input manifest, unchanged current actual input hashes, and intact raw-stream byte lengths/hashes.
It also validates unchanged full-request/saved-copy `e0b54e…1cc63` and diagnostic-request `3e2164…f880a`, blocker/closure DevOps rejection, and absence of the new binding, `.invocation`, `.operation`, result, and private input/output directories.
The parent saved `validate.source` before executing that leaf checker and retained `verify-before.source`/`verify-test-before.source` as frozen current-runner bytes before any future decision.
The existing frozen runner launched only a pure leaf JSON/hash checker with no subprocess descendants; this check neither evaluates cancellation nor resolves the HIGH, and it is not a diagnostic invocation or operational qualification.
Zero diagnostic cases, the unspent grant, absent binding, DevOps source acceptance false, and full-pipeline authority false remain unchanged; the record PASS grants no repair authority.

The targeted bootstrap-security HIGH post-deadline compatibility-module import and MEDIUM unrestricted pre-bound source capture were fixed before these seven gates.
Post-return result parsing now uses only built-ins, actual retained raw case files, the canonical Bun banner, and strict false scope fields; it does not import compatibility code after the bounded invocation.
The outside gate uses bounded no-follow stable reads for all 33 files and raw request/review bytes, returns those bytes, and saves the same authenticated bytes without reopening source paths for capture.
Security withdrew the same-UID source-path TOCTOU HIGH under the explicit accepted C1 model: current-UID repository writers and outer Bun/Mise remain trusted, not adversarial same-UID writers or atomic executable custody.
No source agent may write during gates or operations; this retained model needs no new isolation framework or waiver and does not dismiss abnormal supervisor loss.

| Full first-pass source review | Session | Verdict |
|---|---|---|
| Security | `ses_e42f5a797ffexhsS7I21efHNfy` | `READY_FOR_SINGLE_SYNTHETIC_DIAGNOSTIC_SUITE`: yes, no findings, conditional on all reviews and independent 33-file/140-proof binding before imports/Mise |
| Adversarial | `ses_e42ead667ffeBjPE85tlAd2Kzc` | Same conditional yes, no findings |
| DevOps | `ses_e43032d2effeZfYLV6rBy5HQUM` | No; HIGH cancellation blocker and LOW terminal-summary finding remain open |

###### Current source blocker — runner-cancellation decision required

`_work/gpu-owner-recovery/cuda-bun-compatibility-source-blocker.json` records `BLOCKED_BEFORE_DIAGNOSTIC_INVOCATION`, `SOURCE_REVIEW_ONLY_NOT_AN_ACTUAL_DIAGNOSTIC_FAILURE`, binding absent, zero cases, unconsumed grant, and DevOps source acceptance false.
DevOps HIGH identifies existing `verify.ts` `runBounded`: `child.exited` sets `reaped = true` before `stop` handles unexpected supervisor loss; `killGroup` then skips its `child && !reaped` branch.
[Inference] On that abnormal failure path, reader cancellation, FAIL return, and timer clearing could leave the orchestrator able to launch later cases without descendant-group cancellation.
The existing `verify.test.ts` regression checks failure and latency, not descendant termination; seven source PASS receipts therefore do not close this finding.
No such native failure probe ran and no escaped descendant was observed; this is a source-derived potential failure within C1, not an adversarial same-UID threat or an actual diagnostic failure.
Repairing this frozen cancellation path requires separate explicit human authority before source edits; the diagnostic case grant is still unspent, not consumed or automatically renewed by this finding.

The later read-only architecture advisory from `ses_e43068215ffeuugrCoynxn0LkH` records that owned-group identity after supervisor reap is unproved and the numeric-PGID reuse concern remains unresolved.
Simply removing `!reaped` or reordering the callback is not an accepted repair; an ordinary reused numeric PGID matters under C1 without an adversarial writer, and a liveness check followed by kill does not eliminate that race.
The architect ran no commands or native operations; no ownership-safe repair, impossibility result, required new manager, or actual escaped orphan is established.
The blocker now requests `SELECT_READ_ONLY_CANCELLATION_CUSTODY_DESIGN_OR_KEEP_DIAGNOSTICS_BLOCKED`; its appended advisory is outside the unchanged 242-input source manifest and changes no code, gate result, request, or binding.
The earlier leaf-only record PASS retains its original rejection-flag/integrity scope; it does not evaluate this custody concern or resolve the HIGH.

DevOps LOW records that the invoker's terminal summary reports invocation status without `diagnosticComplete`/`compatibilityPassed`, although the full receipt contains those classifications.
That summary remains unfixed to avoid source-generation drift before the decision; invocation PASS must not be read as compatibility PASS.

The following are pending proposals, not selected authority; the parent will stage owned source/evidence and present the real TUI after the completed leaf-only record check:
The earlier immediate repair-and-test proposal was retracted before any question or selection; it is not a current option or permission.

| Proposal | Exact new scope and retained limits |
|---|---|
| Read-only custody design (Recommended) | Authorize bounded feasibility design using existing primitives, source, and official documentation only. Authorize no code/test edits, test execution, probes, native operations, or diagnostic cases. Return a precise repair proposal only if an ownership-safe argument establishes feasibility; otherwise identify an explicit lifecycle-policy fork. |
| Independent read-only review first | Obtain another ownership/cancellation assessment only; authorize no repair, test execution, probe, native operation, or diagnostic case. |
| Keep blocked | Authorize no new work or operations. |

No proposal is selected now; stop before any new diagnostic operation, with no further operational probe planned before the decision.
Selecting a read-only option would not authorize repair/tests, consume the diagnostic grant, renew the full pipeline, allow real-archive operations, or change runtime policy.
Only after a feasible ownership-safe design may the parent separately request exact repair/test permission; do not promise a minimal fix before that argument exists.
If feasibility requires a new manager, persistent anchor, helper, compilation, memfd, PID namespace, ptrace, or weaker ownership semantics, stop for a new explicit lifecycle-policy decision; none is authorized by read-only design.
Any later authorized repair must address the LOW summary and obtain its persisted descendant-termination regression, all seven fresh source gates, and fresh security/adversarial/DevOps reviews before binding or the one unspent suite.
Historical private-capture `780a90…f58ce`/`e4a2dc…3150a` PASS, actual audit `dacf7e…f173c`/`a968cc…bd9f1` FAIL with its pre-invocation 26-source packet, and read-only plan PASS remain immutable history, not current-source acceptance.
This documentation runs no command, review agent, native probe, or diagnostic case and changes no source or authorization record.
`diagnosticComplete ≠ compatibilityPassed ≠ archiveAuditPassed`; even all three `COMPATIBLE` outcomes do not renew the full archive or LLVM pipeline.
After the suite, require the next real decision: separate explicit real-archive renewal with its own accepted gates, or an explicitly selected runtime/remedy scope.
Preserve root cause `UNDETERMINED`, XZ launch/decompression `UNESTABLISHED`, absent real-archive inventory, and no proven `/proc/self/exe`, kernel, or GPU blocker.
Keep the encoded Bun report URL opaque in unchanged raw evidence; visit or upload nothing.

##### Accepted TAR limits, GNU/PAX grammar, and graph semantics

Stream at most 512 MiB of all decompressed bytes, including headers, extension records, padding, and trailing zeros; cap all headers, including GNU/PAX, at 65,536.
Cap paths at 4,096 bytes and 64 components, each extension payload at 64 KiB, total extension payload at 1 MiB, and encoded inventory at 32 MiB.
Bound graph allocation separately at 131,072 nodes, including implicit directories, rather than assuming the header/path limits alone bound heap use.
Require strict GNU/POSIX wire checksums, octal numerics, strict UTF-8 and padding, two zero EOF blocks, and only zero trailing bytes; trailing zeros need not be a multiple of 512 bytes.
Required numeric fields must be nonblank octal; only unused optional fields may use blank numeric encodings.
Require the single prefix `tracel-llvm-23.1.0-4`; reject traversal, absolute paths, duplicates, special/sparse files, privileged ordinary modes, conflicting GNU/PAX data, unsupported forms, unresolved/cyclic/escaping links, and an archive-provided sentinel.
Allow safe implicit directories; validate insertion and the final complete graph so a late parent link cannot mutate an earlier accepted path.
GNU long-name/link strings require exactly one terminal NUL with no embedded NUL; competing GNU/PAX overrides for the same field fail in either order.
Local PAX supports only `path`, `linkpath`, `size`, `mtime`, `atime`, and `ctime`; global PAX supports only nonnegative time attributes.
Reject global `g` while local GNU/PAX metadata is pending and reject a second local PAX header even with disjoint keys; unsupported forms fail closed, never relax during an actual attempt.
`fixtures/cuda-tar-cases.json` retains 14 logical synthetic cases, now exercised through wire tests and additional regressions; these are not evidence about the actual acquired archive.
Per-file SHA inventory does not compute the publisher composite over sorted installed file bytes; that comparison remains a later installed-file gate.

##### Accepted ELF closure and read-only audit-root source

Parse ELF64 little-endian x86-64 passively with bounded BigInt offsets/sizes, unambiguous file-backed PT_LOAD/dynamic-string mappings, PT_INTERP, and DT_NEEDED.
Conservatively round PT_LOAD memory ranges to 4,096-byte pages when checking mapping ambiguity; metadata must still map to exactly one file-backed segment.
Reject unhandled RPATH/RUNPATH/AUDIT/FILTER/AUX behavior; do not consult environment, loader caches, or alternate search roots to enlarge the closure.
The audit root may expose only existing C1-validated Bun/XZ, their passively inventoried loader/libraries, the read-only pure TAR module, and the fixed read-only archive.
Create explicit directories/read-only child mounts, empty proc, and private dev remounted read-only; remount the root read-only and prohibit ordinary-file creation in dev while allowing necessary special-device I/O.
Expose no broad root, `/usr`, repository/cache, home, `/run`, `.git`, `.env`, sockets, credentials, GPU, or parent proc/root/FD paths.
Permit exactly one exclusively owned inventory-scratch output mount to be writable, never the outside control/receipt directories.
Require bwrap user/network namespaces, dropped capabilities, fixed chdir, no PID namespace/new session/try flags/network fallback, and complete clearenv without XZOPT, proxy, or loader overrides.
C1 validation requires a canonical regular file owned by root/current UID, nonwritable mode, bounded size/hash, and consistent FD reads followed by a closed-FD pathname bind; it is not atomic held-FD mounting.

##### Accepted child/output validation and evidence commit

Invoke a fixed Bun `-e` child inside quarantine, not a standalone internal CLI that could execute XZ outside that root.
The child may spawn only existing XZ with `--decompress --stdout --threads=1 --memlimit-decompress=256MiB -- /inputs/llvm.tar.xz`.
Stream XZ output directly into the TAR parser, not through the runner's 4 MiB stdout retention; drain stderr concurrently with a 64 KiB cap.
Parser/limit failure must stop and reap owned XZ; success requires EOF and zero exit before any PASS, with the existing outside 30-second supervisor as the final backstop.
Write only the bounded inventory to the owned scratch mount; outside the child, revalidate kind, size, strict UTF-8, digest, and scope before write/sync/close and exclusive evidence publication.
The outside wrapper strictly validates string enums and exact fields without coercion, then reapplies the same bounded entry/link graph, not merely the inventory's self-hash.
Require `extHeaders = headerCount - count - 2 >= 0`, matching entry/file-byte totals, and `extHeaders <= extBytes <= min(extHeaders * 65536, 1 MiB)` for nonempty extension payloads.
Require decompressed bytes to cover `headerCount * 512 + paddedFileBytes + max(extHeaders, ceil(extBytes / 512)) * 512`, remain within 512 MiB, and permit bounded arbitrary-length trailing zeros rather than imposing a 512-byte total-length multiple.
Claim only an exclusive `.operation` in the already outside-created `0700` receipt root; never recreate that root, and use separately exclusive owned scratch.
Publish no preliminary PASS; audit means passive inventory only, never custom extraction/installation, sentinel creation, or native LLVM execution.

##### Later native build gates remain open

The requirements below remain design gates, not current authority; the actual passive audit failed and the request is halted pending explicit renewal.
After renewed authority and accepted actual passive audit, allow only unchanged upstream authenticated extraction and genuine sentinel creation; do not write a custom installer.
Before the first Cargo compilation, separately implement/review the minimized full build root and pass actual namespace/custody timeout, descendant-pipe, and supervisor-disconnect tests in that environment.
Neither inert nor acquisition proof qualifies a larger build source/driver/tool/library mount closure or its custody.
DevOps reports no `/usr/include/c++` or `/usr/lib/gcc` in its read-only inventory; runtime libstdc++ alone does not qualify GNU C++ headers/ABI.
Leave that compiler question open without claiming the selected capture qualifies it or asserting that compilation must fail before inspecting exact bytes/tools; no extra GNU/compiler/SDK acquisition or fallback is authorized.
The remaining build limits are:

- Implement and independently review each remaining wrapper/static/synthetic slice before its operations; preserve both original isolation config and minimal tool config/installation guard, and retain root distrust with no new tools, plugins, hooks, automatic installation, or task dependencies.
- Verify the two exact files and reject conflicting cache bytes; audit archive paths/links before extraction. Refuse an unexplained existing prefix; permit reuse only with recorded provenance and fresh content/link/mode checks. Let the unchanged upstream bundler perform authenticated extraction and create its genuine sentinel. Any rollback may touch only the exact prefix newly created by that attempt. Independently verify installed regular-file content, excluding only the separately validated sentinel; check links and modes separately before target two.
- Require actual full-build-environment user/network-namespace and bounded custody tests with the existing outside process-group anchor; forbid a PID namespace, new session, or network fallback. Minimize the source/driver/tool/library closure and bind source, locks, toolchains, registry, and seeded files read-only; enumerate only necessary writable repository caches/scratch/install-prefix/target paths. Expose no broad repository/cache, `.git`, `.env`, home, `/run`, sockets, credentials, parent proc/root/FD paths, nonessential inherited FDs, or GPU devices; retain empty proc and private dev. Fail closed on unsupported isolation, custody, or C++ ABI, preserving the first failure without retry.
- Use existing pinned Rust `1.95.0` and Zig `0.15.2` drivers only. Retain 120 seconds per artifact invocation, 30 seconds for namespace/custody preflight, 600 seconds per compile target, and two Cargo jobs; these development limits do not renew the original 300-second operational deadline.

The two previously selected actual-source commands remain unexecuted and currently denied; explicit renewal, committed capture proof, accepted private-bind archive-v2, successful actual audit, and all full-root/custody gates must precede them, without running test binaries:

```text
cargo test --locked --offline --jobs 2 -p chess-coach-learning --features gpu-cuda --test finite_difference --no-run
cargo test --locked --offline --jobs 2 -p chess-coach-policy-io --features gpu-cuda --test gpu --bins --no-run
```

Exact acquisition and the private capture are complete and cannot replay; the remaining local pipeline is halted, not authorized by an old binding, source acceptance, read-only plan PASS, or record-validation PASS.
The original read-only Bun planner failed before any audit; the later v2 read-only plan passed and actual audit-2 executed private Bun inside quarantine before its abort.
XZ launch/decompression remain `UNESTABLISHED`; no inventory, extraction, installation, LLVM/compiler/GPU result or full-build-root/custody/compiler qualification exists.
Retain exclusions for test/model execution, GPU/host/Docker/image operations, dispatcher enablement, NVIDIA/runtime/driver/SDK/libdevice acquisition, other downloads/new tools/compiler/backend/precision fallback, source/lock modification, training, and publication.
Libdevice loads during NVPTX runtime kernel compilation; its missing bytes alone do not prove these Rust no-run builds blocked, and its consumed acquisition grant remains unrenewed.
Metadata success and a future no-run build would not establish actual GPU F64/C12 or training readiness; reviewed source, selected closing tests, and all three rendered diagrams remain unchanged.

## Historical evidence — NOT FRESH

| Recalled outcome | Recovery interpretation |
|---|---|
| 165 Rust owner tests | Historical report; logs unavailable; the current 72-case suite does not recreate that count |
| 39 CPU tests | Historical report; not a current CPU baseline pass |
| 585 Bun tests / 72 files / 30,444 assertions | Historical report; not a current suite result |
| HIGH security corrections | Reconstructed required fixes, not current reviewer acceptance |
| Final adversarial review `401 FAIL` | Not accepted; do not turn earlier passes into final acceptance |
| Older baseline test/build/render and metadata receipts cited elsewhere | Historical narrative; lost external paths cannot substantiate a fresh result |

Do not fabricate original fixture bytes, original log contents, or the missing final review details.
The 33 shared Rust/Bun policy traces must reconstruct the accepted semantics.
Their new byte identity must not be described as the old fixture identity.
Keep JavaScript Proxy tests separate from the JSON trace suite.

## Fresh recovery evidence — bounded slices, not completion

All run paths in this section are beneath `_work/gpu-owner-recovery/runs/`.
Read each receipt with its retained command streams; passing slices do not aggregate into full legacy-suite, source-review, operational, or readiness acceptance.

### Preferred corrected-source generation

Every receipt in this table reports `PASS`, exit 0, and `sourceChanged:false`; manifest/stream digests bind each run's selected snapshot, not a universal source freeze.

| Run | Fresh result | Scope / limit |
|---|---|---|
| `corrected-source-owner-final-2` | 72 Rust cases, zero failures: 3 JSON units + 13 adapters + 2 CLI + 1 conformance + 8 contracts + 15 lifecycle + 19 observation + 11 wire | One case consumes 33 shared traces; one wire case includes 61 mutations; no extra top-level tests or historical 165-test recovery |
| `corrected-source-clippy-final-2`, `corrected-source-format-final-2` | Locked/offline owner Clippy `-D warnings` and direct Rust 1.95 rustfmt `--check` pass | Same recorded owner manifest as the 72-case suite; not source-review or runtime acceptance |
| `corrected-source-cpu-final-1` | 39 default-CPU tests; two 2,335-coordinate sweeps cover all 4,670 finite differences; default Flex F64 unit passes | Fresh selected CPU source/stream manifest; unchanged precision, seeds, tolerances, and C12 obligations |
| `custody-policy-final-1` | 352 Bun tests / 1,262 assertions | Pure policy, exactly 33 semantic traces, separate native Proxy checks; no hardware qualification |
| `custody-bridge-final-1` | 27 Bun tests / 388 assertions | Includes exact `-0` descriptor-pin and explicit Rust/Bun integer-spelling-limit regressions; no actual GPU/native policy process |
| `authenticated-git-objects-1` | 25 guards / 194 assertions, zero failures; one C14 test filtered out | Raw commit/tree authentication, missing-object no-fetch canary, parser/cache/graph-bound cases, and retained index/physical/input guards; no full C14/native proof or review verdict |
| `exact-selection-runner-final-1` | 12 tests / 72 assertions | Exact file selection, supervisor/reference metadata manifest membership, helper-group custody, and actual counterfactual replacement-ref audit fixture |
| `custody-source-types-final-1`, `custody-test-types-final-1` | Source and test TypeScript checks pass | Recorded custody snapshots; no security verdict inferred |
| `authenticated-git-objects-types-1` | Affected test TypeScript check passes | Same recorded source-manifest digest as the 25-guard run; no source change during verification |
| `exact-selection-tool-types-final-1` | Tooling TypeScript check passes | Same recorded tooling manifest as the 12-test runner/audit suite |
| `security-rust-baseline-packet-3`, `security-typescript-baseline-packet-5` | Bounded baseline diff packets and source/stream manifests retained | Current accepted source-review inputs; TypeScript packet 5 retains the full 18-file baseline diff, while verdicts are separate records |

`_work/gpu-owner-recovery/review-corrections.json` and `recovery.json` now record `REVIEWED_SOURCE_ACCEPTED_OPERATIONAL_QUALIFICATION_OPEN`.
The ledger sets `allListedSourceFindingsCleared:true` and marks filter execution, object ancestry, and lazy-object-fetch `CLEARED_CURRENT_PACKET_5`.
Earlier counts, failed runs, pre-correction generations, and verdicts remain historical evidence rather than being rewritten into current acceptance.
The parent supplied both architect-plan approvals from session `ses_e466298d7ffeUawYMjck0k06fi` before source edits.
HIGH findings changed cleanup authority, evidence/state separation, helper EOF classification, intermediate cgroup custody, and state/config path custody; their retained reasons and exact contracts live in [gpu-owner.md](gpu-owner.md).
MEDIUM findings strengthened physical reference authentication, baseline-object integrity, and manifest completeness; the reference/runner contract below records why logical Git status alone is insufficient.
The LOW exact-negative-zero correction changes typed integer decoding only; it does not rewrite any original manifest/proposal/descriptor commitment or create global lexical Rust/Bun parity.
The later MEDIUM TypeScript filter-execution finding required a separate architect-approved correction: the validator must authenticate the index without invoking a source clean/textconv pipeline.

### Current scoped source review acceptance

`_work/gpu-owner-recovery/security-rust-review.json` persists session `ses_e462ed1aeffefugdBMBe16ejE1` and `READY_TO_MERGE_RUST_SOURCE_SECURITY_GATE_ONLY`, with zero remaining findings in its isolated Rust/C1 scope.
It binds the current 72-case, Clippy, and fmt `corrected-source-*-final-2` evidence and the recorded owner source manifest.
That source-security verdict clears all three original Rust security findings and the reviewed Rust adversarial/numeric corrections under C1; it is not the final adversarial review verdict.
It excludes actual GPU/runtime/filesystems, proc permissions, cgroupfs link-count behavior, atomic Docker bind resolution, and hostile path aliases.
The read-only reviewer executed no commands; reading that persisted verdict here does not constitute a new source review.
The earlier adversarial pass cleared 10 of 11 findings before the no-filter fix; the parent subsequently reports acceptance of the 16-guard/108-assertion no-filter snapshot.
The later MEDIUM CWE-345 object-ancestry finding reopened that gate; the current packet-5 TypeScript security and final adversarial verdicts now clear it within source-only scope.
`security-typescript-authenticated-review.json` records `READY_TO_MERGE_STABLE_TYPESCRIPT_SOURCE_SECURITY_GATE_PACKET_5` for the full 18-file packet-5 diff, with zero remaining concrete in-scope findings.
`adversarial-final-review.json` records session `ses_e4633f9c4ffem033a7XZ2viOY1`, `READY_TO_MERGE_REVIEWED_SOURCE_ONLY_PACKET_5`, cleared object ancestry/lazy fetching, standing prior clearances, and no new or remaining findings in scope.
`backend-integer-review.json` records `READY_TO_PROCEED_SCOPED_RUST_INTEGER_CONTRACT_ONLY`, with zero accepted-contract counterexamples and no global lexical JSON parity claim.
All four reviews were read-only and executed no commands; this documentation pass reads their verdicts without rerunning reviews.
The authenticated guard/typecheck receipts both report `PASS`, exit 0, `sourceChanged:false`, and the same source-manifest digest; packet 5 separately retains `command.stdout`, `sources.json`, and its passing source-bound receipt.
`security-typescript-review.json.currentApplicability` is `HISTORICAL_SCOPE_PRE_PHYSICAL_REFERENCE_PIN_AND_INTEGER_REGRESSIONS`; its earlier READY verdict is not the current TypeScript gate.
These verdicts establish scoped source acceptance only; actual runtime/GPU F64/C12, GPU/driver coexistence, filesystem/fsync/storage, proc permissions, cgroupfs link-count behavior, Gate0/F9/R4, full legacy Bun, and full C14/native proof remain unqualified.
The frozen production Dockerfile remains CPU-only; reviewed optional CUDA source neither restores missing CUDA/LLVM/NVIDIA/libdevice bytes nor renews consumed acquisition authority.
All twelve selected `closure-*-1` reruns now pass, with counts confirmed in their streams and complete selected-manifest/stream validation in `closure-verification-integrity-2`, as detailed in [verification.md](verification.md#closing-validation--selected-reruns-and-final-audits).
`closure.json` indexes the source-only closure, final three-diagram render, and staged hygiene recapture; `closure-lock-and-frozen-boundaries.json` records the current exact lock/frozen-file audit.
The preserved `closure-verification-integrity-1` FAIL came from the whole historical Rust packet's superseded TypeScript guard; the corrected audit compares all twelve closing manifests and all 198 TypeScript packet-5 inputs in full, plus the accepted Rust/root-Cargo 27-input scope rather than claiming all 225 historical Rust-packet inputs are current.

### Earlier recovery checkpoints — superseded generations

The table and checkpoint narratives below preserve prior observations, not the latest corrected contracts or current review acceptance.

| Run | Fresh recorded result | Boundary / remaining gate |
|---|---|---|
| `no-filter-execution-reference-1`, `no-filter-execution-types-1` | Earlier 16 guards / 108 assertions and test typecheck pass with `sourceChanged:false` | `PRE_OBJECT_GRAPH_AUTHENTICATION`; parent-reported adversarial acceptance applies only to that earlier snapshot |
| `security-typescript-baseline-packet-4` | Earlier passing bounded baseline packet retained | Predates object-graph authentication; packet 5 is the current final-review input |
| `exact-selection-reference-final-1` | 13 guards / 88 assertions; `sourceChanged:false` | `PRE_FILTER_EXECUTION_FIX`; the later no-filter 16/108 pass is a distinct generation |
| `security-typescript-baseline-packet-3` | Bounded baseline packet retained with `sourceChanged:false` | Before filter-execution correction; packet 4 followed it but also predates object-graph authentication |
| `owner-connected-fixture-correction-1` | Locked/offline all-targets owner suite: 38 top-level test cases, zero failures; all 12 connected lifecycle cases pass; `sourceChanged:false` | CPU/synthetic helpers only; 33 shared traces belong to one conformance case and 61 wire mutations to one case, not extra top-level tests |
| `owner-integrated-clippy-1`, `owner-integrated-format-1` | Owner all-targets Clippy passes locked/offline with `-D warnings`; direct Rust 1.95 rustfmt `--check` passes; both `sourceChanged:false` | Source/static results for the selected snapshots, not source-review acceptance |
| `rust-core-check-2`, `owner-closure-isolation-1` | All-targets check and normal/build/dev/features dependency tree pass locked/offline; both `sourceChanged:false`; tree excludes Burn/application/host-facts/CUDA | Selected owner inputs restored and offline verified; no actual runtime or GPU qualification |
| `security-rust-baseline-packet-1` | Bounded baseline Rust/root Cargo/support diff packet passes; `sourceChanged:false`; adjacent source manifest and stream hashes retained | Packet preparation only; Rust security, backend parity consultation, and final adversarial review were pending at that checkpoint |
| `tooling-frozen-boundary-audit-types-1` | Tooling TypeScript check passes; `sourceChanged:false` | Does not repair the initializer audit-selector gap documented below |
| `cpu-source-manifest-regression-1` | Preferred locked/offline learning + policy-io result: 39 CPU tests; two 2,335-coordinate sweeps, all 4,670 finite differences; default Flex F64 selector unit; `sourceChanged:false` | `sources.json` has 43 selected inputs with before/end checks and stream digests; predates the last two supervisor guards, not a final everything-hash or owner/CUDA claim |
| `cpu-offline-clippy-1` | Selected learning + policy-io all-targets Clippy passes locked/offline with `-D warnings`; `sourceChanged:false`, source/stream digests retained | Same recorded 43-input manifest generation as the CPU regression, not Rust-owner or full-workspace acceptance |
| `cpu-f64-selector-regression` | Earlier 39-test CPU checkpoint | Retained, but predates the parent's source-manifest upgrade; do not claim it hashes a complete source snapshot |
| `reference-replacement-ref-regression-1` | Latest reference-source guards: 5 tests / 34 assertions; `sourceChanged:false` | Includes Git replacement-ref rejection without alternate-code execution; one full bundle test remains filtered out |
| `tests-reference-replacement-fix-1` | Test TypeScript check passes; `sourceChanged:false` | Same recorded source-manifest digest as the 5-guard run; not final unified verification |
| `reference-canonical-root-corrected` | Earlier 4 reference-source guard tests / 24 assertions; `sourceChanged:false` | `PRE_REPLACEMENT_REF_FIX`; retains `assume-unchanged`/`skip-worktree` negatives, not verification of the later replacement-ref control; the canonical-root first failure in `reference-integrity-recovery` remains retained |
| `fidelity-policy-1` | 352 tests / 2 files / 1,262 assertions; `sourceChanged:false`; exactly 33 reconstructed shared traces | Post-correction Bun policy evidence; the separate owner run now also passes those 33 traces within one Rust case; no historical fixture-byte identity claim |
| `fidelity-policy-source-1`, `fidelity-policy-tests-1` | Source and test TypeScript checks pass; both `sourceChanged:false` | Recorded correction snapshot only; final unified checks remain the parent's gate |
| `fidelity-bridge-1` | 24 tests / 3 files / 359 assertions; `sourceChanged:false` | Closed receiver predicates plus real SQLite/fixed factory/MatchWorker and fake Bun learners; no real native learner/GPU or Rust-owner acceptance |
| `fidelity-source-1`, `fidelity-tests-1` | Source and test TypeScript checks pass; both `sourceChanged:false` | Recorded bridge correction snapshot only; final unified checks remain pending |
| `runner-supervisor-loss-fix-1` | Latest harness: 9 tests / 28 assertions; `sourceChanged:false` | Covers inherited-pipe hang, unexpected supervisor loss after command exit zero, and IPC-disconnect group cleanup; DevOps permits selected offline checks only |
| `tooling-supervisor-loss-fix-1` | Latest recovery-tool TypeScript check passes; `sourceChanged:false` | Same recorded runner source-manifest digest as the 9-test run, not overall source/review closure |
| `tools-review-packet-types-1` | Later review-packet tooling TypeScript check passes; `sourceChanged:false` | 14 selected tooling manifest entries; not a rerun of the runner tests |
| `security-typescript-baseline-packet-1` | Bounded baseline diff packet passes; 18 changed files, including tracked and untracked source/test/fixture additions; `sourceChanged:false` | Packet manifest has 195 inputs, not 195 reviewed diff files; security acceptance is scoped below |
| `runner-group-custody-fix-1`, `tooling-group-custody-fix-1` | Earlier 7-test/20-assertion harness and tooling check pass; `sourceChanged:false` | Before the final unexpected-loss/disconnect guards; do not use as verification of the 9-test runner snapshot |
| `runner-provisioning-adapters`, `runner-integrated-recheck-1` | Earlier 6 harness tests / 17 assertions; `sourceChanged:false` | `PRE_RUNNER_CUSTODY_FIX`; neither verifies the new supervisor |
| `recovery-tool-manifests-types` | Earlier recovery-tool TypeScript check passes; `sourceChanged:false` | `PRE_RUNNER_CUSTODY_FIX`; no inferred pass for later edits |
| `offline-reconciled-diagrams-1` | Both prior reconciled diagrams actually render to valid SVG offline, `SANDBOX`, no includes; `sourceChanged:false`; source/output hashes retained | Earlier diagram generation; this source-status update edits both diagrams, so parent must rerender them again |
| `offline-recovery-diagrams-first` | Earlier two-diagram SVG render passes; output hashes retained | Earlier diagram generation only; retained separately from the reconciled render |

Earlier 276-test policy passes and 21-test/299-assertion bridge passes are `PRE_FIDELITY_CORRECTION`, not evidence for the corrected contracts.
The 33 traces reconstruct accepted semantics; five reason-classification expectations were corrected without changing that count.
Full legacy Bun verification has not rerun: hardcoded external temporary paths, missing reference inputs, and native prerequisites prevent a valid full-suite claim.
The earlier TypeScript security verdict below remains historical; the current scoped acceptance records above supersede its applicability, not its recorded bytes or scope.
The pre-runner-fix integrated observations also passed with `sourceChanged:false`: `policy-integrated-recheck-1` (352/1,262), `bridge-integrated-recheck-1` (24/359), `source-integrated-recheck-1`, `tests-integrated-recheck-1`, `reference-integrated-recheck-1` (4/24), and `runner-integrated-recheck-1` (6/17).
They record actual code-check outcomes, not verification of the new custody runner; parent will repeat final checks after the fix.
The earlier integrated reference result (4/24) is `PRE_REPLACEMENT_REF_FIX`; do not overwrite it with the newer 5/34 result.
The parent extended read-only adversarial review to connected Rust plus stable TypeScript/CUDA/tooling in session `ses_e4633f9c4ffem033a7XZ2viOY1`; the preceding 10-of-11 clearance and later parent-reported no-filter acceptance belong to their own pre-object-authentication snapshots.

### Earlier connected owner and audit — superseded generation

`owner-connected-fixture-correction-1/command.stdout` records exactly 38 Rust test cases: 10 adapters, 2 CLI, 1 shared-policy conformance, 6 contracts, 12 connected lifecycle, and 7 wire cases.
This pass is `PRE_SECURITY_AND_INTEGER_CORRECTION`; the 70-case `security-custody-integration-1` checkpoint is `PRE_LINK_COUNT_GUARD`, before the two added leaf-rename observations.
The single conformance case consumes exactly 33 reconstructed semantic traces; one wire case applies 61 contradiction mutations.
Do not add those nested examples to the test-case total or recreate the lost historical 165-test claim.
The connected fixture executes real Rust `run_once` through fake Docker/query/proc/cgroup adapters into the real Bun GPU-job loop, SQLite coordinator/fixed factory, MatchWorker, and two fake Bun learners for one attempt.
It executes no actual Docker, GPU, or native policy/learning process and supplies no operational qualification.
Post-SQLite trailing output/nonzero exit remain failures; evidence-path failure still triggers ownership inspection and exactly owned cleanup, while wrong image/label still prohibits removal.
Premature startup during incomplete input delivery fails, and an empty retained cgroup still fails disappearance before the original final deadline.
Parent corrected only synthetic `cgroup.threads` creation/removal and a fixture `collapsible_if` warning for the passing correction; the accepted resource/observation contract was not relaxed.
Retain `rust-core-test-1` with its six lifecycle failures and `rust-core-clippy-2` with the preserved-fixture `collapsible_if` failure as failed earlier generations.
Each successful check/test/static/tree receipt binds its own selected source snapshot with `sourceChanged:false`; their distinct manifest hashes are not one final source freeze.
The closed `owner-format` runner mode invokes the selected Rust 1.95 `rustfmt --check` directly on owner Rust files, with no install or source rewrite.

`_work/gpu-owner-recovery/integrated-lock-and-frozen-boundaries-1.json` records `OWNER_MEMBERSHIP_ONLY` at the root workspace and the exact owner/FFT/four-list lock delta above, with existing versions/checksums and all other package blocks unchanged.
Its frozen-source entries retain baseline byte equality and current hashes for the enumerated tracked `tooling/runtime` F9/Docker/metadata files, `crates/host-facts`, existing native `job.ts`, state/episode schemas, root `package.json`, and `bun.lock`.
The bounded audit disables Git replacement objects and uses a private environment; it is not a full source review, a runtime qualification, or a GPU input grant.
That earlier audit omitted the actual initializer because its selector named `policy-init.rs`; retain it as historically incomplete, not initializer byte-equality evidence.
The parent corrected the selector to `crates/policy-io/src/bin/policy-initialize.rs`, made its presence mandatory, and recorded `_work/gpu-owner-recovery/corrected-initializer-frozen-audit-1.json`.
The corrected audit retains that file's baseline byte equality and SHA-256 `1024cb2f47bcb5cf494be6da0016ca583342346544a3eb20ca52bf19a001fdf2`, along with the exact workspace/lock and other enumerated frozen boundaries.

Packet generation 1 and its requests belong to that earlier checkpoint; current Rust packet-3 and TypeScript/adversarial packet-5 source acceptance is recorded above.
Rerendering the changed diagrams remains the parent's gate.

### Historical TypeScript security verdict — not current acceptance

`_work/gpu-owner-recovery/security-typescript-review.json` records session `ses_e463cc8a8ffenbLOljn5xc5Jaz` and `READY_TO_MERGE_STABLE_TYPESCRIPT_SOURCE_SECURITY_GATE_ONLY`, with zero remaining findings in the reviewed scope.
Its current-applicability marker explicitly makes this historical before physical-reference pinning and integer regressions; it must not close today's TypeScript security gate.
The read-only reviewer ran no commands and reviewed the 18-file baseline diff packet at `runs/security-typescript-baseline-packet-1/command.stdout`, with its adjacent `sources.json` and `receipt.json`, against baseline `c04a8da9468f7d443bd27d73a08c0bd7ee0e9d20`.
The packet includes four tracked-file diffs and fourteen untracked-file additions; its 195-input source manifest is not the reviewed-diff count.
The addressed MEDIUM CWE-345 finding allowed Git replacement refs to substitute a different commit tree while `rev-parse HEAD` still returned the expected pinned identifier.
The Git helper in `packages/runtime/tests/reference-bundles.test.ts` now applies global `--no-replace-objects` before its subcommand so the guard compares the original pinned objects.
The new synthetic regression stages an alternate index/worktree, retains the expected HEAD, proves the previous cached-HEAD diff returns success with replacement refs, and verifies the fixed guard rejects the substitution.
It executes no alternate reference code; the full bundle test stays filtered out.
The 5-test/34-assertion run and test typecheck pass with `sourceChanged:false`; the earlier 4-test generation remains separate.
This source-security verdict excludes Rust, full legacy-suite acceptance, adversarial acceptance, operations, and training readiness.

### Physical reference, baseline audit, and manifest custody

Implemented ancestry repair: [reference-bundles.md](reference-bundles.md#authenticate-before-interpreting) and [reference/object-graph-authentication.puml](reference/object-graph-authentication.puml) document raw commit/tree authentication before the retained checks below.
The 16/108 source snapshot used unauthenticated tree listing output; matching its inventory does not prove the independently pinned object's ancestry.
An owned clone can shadow a subtree's OID pathname with an altered compressed body without a SHA-1 collision, so the new inventory must derive exclusively from a body-hash-authenticated graph.
Hash the raw commit body against the independent pin before parsing its first strict root OID, then hash every raw binary tree against the OID requested from authenticated ancestry.
The raw commit command returns an unframed body; tree batches require exact OID/type/size/body/LF framing and Git body hashes before binary parsing.
Breadth-first traversal retains strict UTF-8 names/modes, per-validation node caching with every parent path instantiated, and independent metadata/work/path limits.
The implemented caps are 4 MiB for metadata/batch stdin/cumulative tree I/O/aggregate path bytes, 4,096 cached trees, 16,384 instantiated entries, pending tree depth 32 from root 0, and individual UTF-8 paths of 4,096 bytes.
The graph deadline is 20 seconds starting before commit retrieval; physical scanning has separate 16 MiB/file and 128 MiB aggregate blob limits, not a whole-validator 20-second or atomic snapshot guarantee.
Require `GIT_NO_LAZY_FETCH=1` and `GIT_TERMINAL_PROMPT=0`; missing required objects must fail without promisor helpers or acquisition, never trigger history-wide fsck or automatic fetch.
The fresh 25-case suite passes the no-fetch local-canary and owned-clone commit/tree-corruption regressions, plus binary/batch/cache/graph-bound and retained guard cases.
Ordinary Git advertises forged content under a genuine HEAD while the new guard rejects body-hash mismatches; old-reader missing-tree lookup invokes the local canary while failing, but current validation rejects without its marker.
Corruption fixtures write only local loose objects in owned clones, never shared alternate stores; the counterfactual authorizes no actual network or host operation.
The repair preserves the existing SHA-1 pin model and makes no atomic filesystem snapshot claim.

The reference guard requires the canonical Git top-level root, original pinned HEAD/tree, and SHA-1 object format; a canonical tracked subdirectory must fail before bundle construction.
Authenticate raw physical blob bytes against original tree object IDs, plus tracked directory/file kinds and executable mode, without symlinks or populated submodule sources.
Require Git `--no-replace-objects` and H-flag checks, then compare `git ls-files --stage -z` with the original pinned tree's non-tree entries as an exact mode/OID/path stage-0 set.
Reject missing, extra, duplicate, unmerged/nonzero-stage, or mismatched entries; even restored physical bytes cannot excuse an altered staged index.
The validator must invoke neither worktree nor cached Git diff and must never execute a source clean/textconv pipeline.
Disabling external diff/textconv flags alone does not disable clean filters from untrusted local Git configuration; byte-identical files can still invoke them after an mtime change.
Before importing any bundle, require every consumed input to belong to that original tree and match its byte length/SHA-256; selected entries must be present exactly once and physical bytes must be reauthenticated after inventory capture.
The pinned empty `orrery` gitlink placeholder is allowed only while empty and is never a consumable bundle input.
An owned regression intentionally invokes the old vulnerable diff in a private clone with a Bun marker/echo clean filter and byte-identical tracked content after an mtime change, proving the filter runs.
After removing that marker and changing mtime again, the corrected guard passes without recreating it; this deliberate fixture execution is not part of the validator.
Staged-change/physical-restore and extra-index-entry negatives join clean-filter, subdirectory, symlink, populated-submodule, untracked-input, and changed-input refusals.
`no-filter-execution-reference-1` records 16 guards / 108 assertions, zero failures, and one C14 test filtered out as `PRE_OBJECT_GRAPH_AUTHENTICATION`; `exact-selection-reference-final-1` remains `PRE_FILTER_EXECUTION_FIX` at 13/88.
`authenticated-git-objects-1` supersedes those reference guards at 25/194, with one C14 test still filtered; none establishes a fresh full C14 runtime/native proof.

The replacement-ref audit regression uses a private sparse clone: alter a checksum, replace the baseline commit, prove a lax audit copy accepts, then prove the current original-object audit rejects.
It never changes the actual workspace's Git refs, and sparse checkout avoids duplicating the test tree into fixture discovery.
Every ordinary verification-runner manifest includes executed `command-supervisor.ts` and pinned `tooling/reference-entrypoints.json`; the runner regression checks mode membership.
All Bun test commands now use exact `./` file selectors so path-filter discovery cannot collect tests from private fixture clones.
The selected policy/bridge custody receipts retain their original pre-selector argv and actual successful observations; exact-selection reference/runner receipts separately verify the later selector fix.

Preserve `custody-reference-final-1` as FAIL: its 13 guard passes were followed by unintended audit-clone test discovery and a missing-Zod error.
Preserve `reference-physical-pin-1` and `reference-physical-pin-types-1` as source-changed failures where recorded, even when command logs show tests passing.
Earlier 38-case owner passes are `PRE_SECURITY_AND_INTEGER_CORRECTION`; intermediate 70-case passes are `PRE_LINK_COUNT_GUARD` and cannot verify the final 19-case observation suite.

### HIGH runner custody corrections — selected offline checks only

DevOps found a HIGH deadline hang in the earlier bounded runner: an immediate command could exit while a surviving descendant retained stdout, leaving stream draining blocked after command reap.
The parent added `_work/gpu-owner-recovery/command-supervisor.ts` as a live process-group anchor and passes the command's exact environment through Bun IPC.
The anchor stays alive until the original command exits and both inherited streams reach EOF, or the original deadline/output failure initiates shutdown.
The runner sends owned-group SIGKILL before supervisor reap; it must not reap the authority anchor and then signal a potentially reused numeric PGID.
Unexpected anchor loss fails the run and cancels readers rather than signaling that reused group identity.
Unexpected anchor loss remains failure even after command exit zero; IPC disconnect makes the still-live supervisor SIGKILL its anchored owned group rather than exiting and abandoning descendants.
The parent records all three HIGH findings addressed in `_work/gpu-owner-recovery/devops-runner-review.json`, session `ses_e463e78dfffe4YAnf2hT72bQKo`.
The read-only reviewer ran no commands and returned `READY_TO_CONTINUE_SELECTED_OFFLINE_CHECKS_ONLY`, with zero blocking findings in that reviewed scope.
That verdict is not adversarial, security, operational, full descendant/cgroup, or final source acceptance.
The latest regression/tooling receipts verify the recorded final runner snapshot; the 7-test checkpoint predates the last two guards, and all 6-test checkpoints remain `PRE_RUNNER_CUSTODY_FIX`.
The Cargo runner records `sources.json`, a source-manifest digest, before/end source comparisons, and stdout/stderr digests.
The preferred CPU regression and CPU Clippy bind their recorded 43-input manifest; Rust sources remain unchanged in that snapshot, but it predates the last two runner-guard edits and cannot bind those later runner bytes.

### Earlier runner-only checkpoint

The receipt `_work/gpu-owner-recovery/runs/runner-repository-root/receipt.json` records `PASS`, exit 0, `sourceChanged:false`, and actual Bun `1.4.0`.
This checkpoint is `PRE_RUNNER_CUSTODY_FIX` and does not verify the new command supervisor.
Its `command.stderr` records **6 tests across 1 file, 0 failures, and 17 assertions** for `_work/gpu-owner-recovery/verify.test.ts`.
The recorded source manifest contains seven files; this is not a count of reconstructed CUDA source files or owner tests.
The receipt keeps `actualHostExecuted:false`, `cudaGpuCodeExecuted:false`, and `trainingReady:false`.
It verifies the bounded runner only: output, nonzero exit, deadline termination, stream overflow, and work-root rejection.
Do not reuse it as owner, policy, bridge, full Bun, CPU model, or CUDA source verification.

Retain both earlier runner reconstruction failures:

- `_work/gpu-owner-recovery/runner-initial-parse-failure.json`: parsing failed before the selected command launched.
- `_work/gpu-owner-recovery/runner-root-correction.json`: the first root calculation selected one directory above the repository.
- `_work/gpu-owner-recovery/runner-output-recovery.json`: the parent's recovery record preserves that failed output under `_work/gpu-owner-recovery/runs/runner-parse-correction/` inside the repository.

The parent reports nine reconstructed CUDA leaf files and six ignored actual-GPU fixtures.
No fresh compilation or execution of that leaf is established; app initialization remains unchanged.
The corrected owner retains the 72-case/static results and current scoped Rust/TypeScript/backend/adversarial source acceptance above; full legacy Bun coverage and optional CUDA compilation/operational qualification remain unestablished.

## Required recovered fixes

The parent supplied architect approval `ses_e466298d7ffeUawYMjck0k06fi` for contract fidelity: restore telemetry SHAPE precedence and existing receiver predicates without adding root/curriculum replay or weakening actual producer pins.

1. Evidence failure must not prevent ownership inspection or removal of an exactly owned container.
   Use an explicit internal cleanup mode with best-effort evidence only during cleanup.
   Latch storage failure, stop ordinary work, and skip further serialization/I/O after that latch.
   Preserve the first failure and subsequent cleanup faults; never manufacture successful evidence.
2. Keep attach alive until ownership inspection and C8 membership binding complete.
   Then stop the owned attach helper without waiting for EOF, remove the exact owned container ID while draining concurrently, and finish helper reaps plus exact cgroup disappearance.
   Wrong labels or image must prohibit removal even after evidence failure.
3. Accept startup only after the bounded start write completes and stdin actually closes.
   Queued intent and forced pipe closure do not satisfy that condition.
   The cold `S0+10s` boundary remains active until a valid startup is accepted.
4. Mirror the existing `trainingStateShape` closed-state/counter/control/history predicates and stream-prefix relationships at the TypeScript and Rust receiver boundaries.
    Rust uses wide `u128` intermediate arithmetic for prefix checks.
    Receiver validation does not derive master RNG roots or replay Fisher–Yates, curriculum cursor/epoch progression, learning, model updates, or journals.
    The producer's actual initial-state/record/descriptor pins and exactly one real in-job attempt remain unchanged; no game or curriculum work moves outside the job.
5. Both validators must hash the exact descriptor token bytes in the same original proposal JSON after recursively rejecting duplicate decoded keys.
   Rust uses borrowed `RawValue` from the original input, not a reconstructed `Value`.
   Bun captures the top-level token using decoded field names and excludes surrounding whitespace.
   Regex extraction and reserialization are forbidden.

## Repository-owned recovery order

| Order | Goal | Required verification boundary |
|---:|---|---|
| 1 | Restore these tracked goals before source reconstruction | Readback, contract/coverage checks, and plain PlantUML validation when available |
| 2 | Restore `tooling/runtime/gpu-policy.ts` and `tooling/runtime/fixtures/gpu-policy-traces.json` | Both exact `gpu-policy` test files; 33 reconstructed semantic traces, separate native Proxy rejection tests; no hardware/provider call |
| 3 | Restore disabled Rust owner, closed manifest, file pinning, clocks, adapters, evidence, and cleanup | Bounded fake helper/proc/cgroup fixtures; failure ordering and ownership negatives |
| 4 | Restore contracts `gpu-job.ts`, runtime `gpu-job.ts` with its disabled main, and strict state/proposal validators | Exact contracts/runtime job tests, `fixed-attempt-gpu-owner.test.ts`, and owner fixture tree; real SQLite/fixed factory/MatchWorker with two fake Bun learners; no actual GPU/native binaries |
| 5 | Restore optional CUDA source under retained precision/dependency boundaries | Static/locked verification where available; the new input grant covers only owner/default-CPU, not missing CUDA/LLVM bytes |
| 6 | Freshly verify reconstructed source and seek new source reviews | New bounded repository-owned receipts, adversarial review and applicable security review; no inherited acceptance |

This document supplies the recovery plan; no additional `_work/` PLAN is required.
The parent has created repository-owned `_work/gpu-owner-recovery/verify.ts`, `verify.test.ts`, `recovery.json`, and `environment.json` with bounded runner records.
Their `SPEC:` pointers identify this recovery contract; they do not make the runner a real GPU owner or a source-verification result.
Keep the new AGENTS repository-owned work rule: task work stays inside the repository, bounded scripts/manifests/receipts/stream evidence are tracked, and caches/compiler outputs stay out of Git.
This pass does not run Git or modify those harness files.

Keep new runners, fixtures, scripts, manifests, receipts, and bounded `.stdout`/`.stderr` files inside the repository.
Do not use `/tmp` or `/tmp/opencode` for new task work.
Do not back up giant caches or compiler outputs into Git.
Keep development scratch/build products distinct from bounded tracked evidence.
Preserve failed verification outcomes without overwriting them with later passes.

## Coverage bootstrap and documentation limits

`_spec/.spec-index.json` did not exist in the inspected baseline.
The index initially projected the two reconstructed GPU diagrams; it now also projects the implemented reference object-graph authentication concern, not reconciled or complete legacy coverage.
Every listed fingerprint starts at `null` for the drift guard to compute.
Every edge matches reconstructed source or fixtures; the explicit receipts, not file existence or a coverage edge, establish the verified synthetic subsets.
Existing integration globs provide coverage of the actual retained boundary without inventing source pointers.
The corrected headers and index use the exact recovered file plan above, not invented alternative source paths.
The owner retains ten coverage edges and the pure policy five; the reference concern retains three explicit edges, and all fingerprints remain `null`.

`_spec/template.txt` was absent during reconstruction.
Template check: `SKIP` because no local template exists and the parent reports the official historical URL returned HTTP 404.
The earlier fetch/commit request is withdrawn; do not ask Executor to obtain an unavailable template or retry the network here.
Use default offline vanilla PlantUML without remote includes; this pass fetches no template or theme.
No `TestSpecNotesFitTheBox` or `specNotesEnforced` list was found in the inspected tree.
Adding a test ratchet outside `_spec/` belongs to build, if that harness is introduced.

### Diagram note checks from this documentation pass

These arithmetic checks do not constitute source verification or a render of the latest diagrams.
Each retained or new reasoning note has two sentences, two to five lines, and no content line wider than 50 columns.
FK uses note text without PlantUML markup and a word/syllable count, not a rendered-image estimate.

| Note | Words / sentences / syllables | FK grade |
|---|---|---:|
| `gpu-owner.puml` · note over OWNER, JOB | 15 / 2 / 29 | 10.1 |
| `gpu-owner.puml` · note over OWNER, IO | 16 / 2 / 33 | 11.9 |
| `gpu-cooperative-policy.puml` · note over CALLER, POLICY | 22 / 2 / 40 | 10.2 |
| `reference/object-graph-authentication.puml` · note over GUARD, ODB | 18 / 2 / 35 | 10.9 |
| `reference/object-graph-authentication.puml` · note over GUARD | 18 / 2 / 34 | 10.2 |

`runs/offline-reconciled-diagrams-1/receipt.json` records the post-reconciliation render of both diagrams with source/output hashes and `sourceChanged:false`.
It verifies that earlier diagram generation only.
`runs/closing-three-diagram-render-1/receipt.json` records a newer PASS for all three diagrams, valid SVGs, offline `SANDBOX`, and `sourceChanged:false`, but its hashes still bind pre-acceptance-label bytes.
`runs/source-accepted-diagrams-1/receipt.json` passes the first acceptance-label generation, which still contained render-pending annotations.
`runs/source-accepted-diagrams-2/receipt.json` passes all three final diagrams after removing those self-referential annotations; the offline `SANDBOX` receipt records valid SVGs, source/output hashes, and `sourceChanged:false`.
Source reviews, all twelve selected closing reruns, their scoped integrity audit, the closure frozen-boundary audit, and the final three-diagram render are complete; staged hygiene/whitespace evidence is indexed separately by `closure.json`.

## Still denied

Actual UUID, thresholds, host controls/paths, state/evidence targets, provider, image, and accepted Gate0 inputs remain unset.
Host/GPU inspection or execution, image/container/capture/production-build operations, production registration, NVIDIA/SDK/libdevice acquisition or installation, test/model execution, training, and publication remain denied.
Earlier successes, failures, and the read-only Bun-ancestor halt remain history; Executor selected the exact private byte capture with retained outer-bootstrap C1 trust and renewed the remaining local-development pipeline until the actual audit-2 abort.
The private copy passed and its grant is consumed; archive-v2 source acceptance and read-only planning passed, private Bun execution/abort is established, root cause remains `UNDETERMINED`, and XZ launch/decompression remain `UNESTABLISHED`.
Actual audit success, inventory, and later build/custody/ABI qualifications remain absent; the full archive pipeline remains halted, while the separate diagnostic grant remains conditionally approved and unspent.
Diagnostic implementation and seven fresh static gates are complete, but DevOps HIGH blocks source acceptance, binding, and execution; no diagnostic native case has run.
No read-only custody-design/review proposal, repair/test permission, helper build, or real-archive renewal is selected; the leaf-only record check passed without resolving the HIGH, and the parent must present the design-first decision before any diagnostic operation.
The record-only validator and security/adversarial TUI-record verdicts grant no operations or documentation/source approval; neither recapture, completed-acquisition replay, nor crash-report URL visit/upload is authorized.
Historical approvals remain consumed where recorded.
Reconstruction creates no operational retry, fallback, reserve, or renewed clock origin.
Fresh 25/194 object-graph/no-fetch and affected-typecheck receipts plus packet 5 are retained, and scoped source verdicts are accepted; no host/container/GPU/training/publication or Git commit/push permission follows.
