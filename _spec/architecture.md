# Clean rebuild

## Goal

Rebuild around maintained community interfaces instead of carrying the previous experimental infrastructure forward.

The clean rebuild began without the previous branch's commit ancestry, tooling or design-history tree. Its read-only behavior reference remains `b4b241481fb12de4a7344e6dba8eda775af57675`. The isolated integration brought the product applications and ML packages into one workspace. Executor subsequently approved **Consolidate + fixes**: one `starchess-core` physics kernel, explicit product/native validation facades and mutation-time causal journaling. Executor then selected **Move tests; retire shim**. [engine-consolidation.puml](engine-consolidation.puml) records the current layout contract. The recorded post-codec scoped Bun pass predates this layout change; the separate fresh layout Bun pass is recorded below. Native/runtime/training qualifications remain separate.

## Current layout — move tests; retire shim

`packages/starchess-core/tests/native` owns the entire retained native admission/physics corpus: 25 test files, five corpus helpers and seven JSON fixtures, moved as one directory. `canonical-exports.test.ts` replaces the obsolete `compatibility-exports.test.ts` ownership check. It verifies canonical API ownership and producer-free product/native dependency closures rather than equality with a forwarding package. The seven fixtures must retain exact bytes, modes and raw historical source fields. Neither their provenance nor prior proof commands are rewritten to resemble current paths.

The approved layout removes all 27 `packages/game-core/src` forwards and the private `packages/game-core/package.json`. Contracts and policy drop their legacy development dependencies; runtime already consumes the canonical engine. The three ML packages keep their algorithmic ownership. All 153 files under `packages/starchess-core/src` remain byte-identical to the lead's baseline, including existing source `SPEC:` pointers. `_spec/game-core.puml` and `_spec/game-core.md` retain their filenames as provenance and describe canonical ownership, not a live compatibility engine.

Current Bun command: `bun test packages/starchess-core/tests/native`. The core's `test:native` script selects only that Bun corpus; its product `test` script keeps Vitest `src/__tests__` separate. Root `ml:test` includes the new native-test directory. Root source/test TypeScript configs replace retired roots with canonical engine/native-test roots without merging the two test runners. Retired-package import negatives must now fail as unapproved or unresolved; host-producer negatives must still reject the canonical producer. Runtime-closure outputs belong under `artifacts/engine-layout`, not frozen consolidation evidence.

**Layout verification: 14/14 fresh Bun checks PASS.** [final-1/summary.json](../artifacts/engine-layout/checks/final-1/summary.json) records exit 0 and `sourcePinsMatch:true` for every check. The lead records core 432 + arena 24 + app 790 + selected pure ML 410 + workspace 8 = **1,664 tests**, plus **seven strict TypeScript gates**, app dependency boundaries and layout preservation. The separate `test:native` entrypoint pass at `artifacts/engine-layout/checks/initial-1/native` contains 211 tests already represented in the selected ML total; do not add it again. The matching 1,664-test count in the old consolidation run is coincidental: its **13 gates** and original receipts remain historical, distinct from these **14 checks**.

The layout check records 37 moved files, seven byte-identical fixtures, 29 import-only TypeScript files, 153 unchanged canonical source files, 254 unchanged recorded historical artifacts and 27 retired forwards. The lead's baseline comparison also verifies fixture/source/artifact modes. `artifacts/engine-layout/baseline-1.json` remains the pre-edit comparison, not a post-edit PASS. This final-1 status supersedes earlier pending-layout annotations without replacing historical receipts. The lead reports source READY with no findings from adversarial review `ses_e19f8b80effepgJ7oC0nZ9foSQ` and security review `ses_e19f8b7f9ffeMaNmScApSXUFJp`; these static reviews did not recompute hashes.

This status-only documentation closure reruns no checks and recomputes no hashes. The task performed no install, network acquisition, Rust/GPU execution, training, commit or push. Original user work and the pending merge remain preserved. No runtime qualification or training approval follows. Native PlantUML rendering is skipped under Bun-only verification scope; full remote-theme rendering remains unverified.

## Component boundaries

Executor's current execution design uses host mise for preflight/seeding/provisioning and a supported shared-GPU host Docker learning job.
The coding agent remains in sbx.
Host-backed state and real F64 GPU scoring/learning are required for readiness; the CPU Flex foundation remains the reference/test backend, not a GPU-ready training fallback.
Hardware and runtime qualification retain their separately recorded scope; this workspace integration performs no fresh GPU qualification. See [gpu-readiness.md](gpu-readiness.md).

| Component | Responsibility | Current state |
|---|---|---|
| `packages/starchess-core` | Canonical StarChess geometry and B/C/F physics; distinct product/native admission; optional per-game effects | Product root preserves SCFEN, SAN, replay, AI and helpers; all 153 source files stay unchanged during this layout task |
| `packages/starchess-core/tests/native` | Retained Bun native admission, physics and journal regressions | All 37 files retained; seven fixture bytes/modes preserved; fresh layout Bun checks passed |
| `packages/contracts` | Recipient-local observations, economic data ownership and deterministic source replay | Standard journal/batch/observation schemas, continuing producer, explicit banks/receipts, atomic BOTH data successors and replay implemented |
| `packages/policy` | Recipient-local candidate enumeration and observation/action encoding | New bounded enumerator and 2,271-coordinate encoder implemented |
| `crates/learning` | Burn model, episodic objective, gradients, optimizers and native model records | Standard 2271->32->1 MLP; synthetic tests pass |
| `crates/policy-io` | Frozen native-checkpoint scoring through standard JSON/Serde process I/O | Native and cross-language synthetic e2e verified with actual versioned encoding |
| `packages/runtime` | Match orchestration, bounded policy sessions, frozen scoring and learner coordination | Runtime code and synthetic e2e fixtures exist; actual game-corpus qualification and production training remain unestablished |
| `apps/chess`, `apps/starchess` | Existing game/coaching interactions and platform entrypoints | Applications coexist with the ML packages; product policy integration remains pending |

Migrate a component only when its consumer, retained behavior and regression tests justify it. Do not copy obsolete experiments merely to satisfy a historical import path. Preserve game behavior rather than the previous workspace layout.

The approved target uses `@chess-coach/starchess-core/engine` as the narrow pure rules/planning entrypoint. `/causal-types` exposes constructor-free sink contracts. `/causal-producer` owns host-only collection, and neither it nor `CausalJournal` may enter policy runtime/type/reexport closure. Product incoming-action admission remains soft; native ML admission checks classical dependencies. These are different validation contracts, not different geometry or physical resolution. Journaling must never select the facade. The public product root retains its existing API and remains outside model-facing imports. `packages/engine-core` still owns chess-commentary prompt and FEN/move-token helpers, not StarChess rules. See [ml-runtime-architecture.puml](ml-runtime-architecture.puml) and [engine-consolidation.puml](engine-consolidation.puml).

The target instruments actual mutations through optional per-game `ResolutionEffects`; physical results must agree with and without that sink. The only approved product behavior changes are the live own-Marine promotion guard and delayed-swap mine synchronization described in [game-core.md](game-core.md). Preserve app-facing events and `afterPending`, `afterB`, `bMoves`, `fMoves` and `EndScTurnResult` timeline meanings. Do not replace the causal journal with a final-snapshot diff or app events.

## Model contract

- 2,271 input coordinates, `f64`, 1–512 candidate rows.
- Finite input values with absolute value at most 1,000,000.
- Seeded standard hidden initialization and a zero, bias-free output head in a Burn Linear -> ReLU -> Linear model.
- Burn owns module parameters, differentiation, optimizer updates and record encoding.
- No handwritten gradient engine, checkpoint format or dependency resolver.
- Synthetic optimizer tests do not authorize training on game data.
- Preserve the summed episodic policy objective, frozen baseline, 64-decision cap, temperature 1, learning rate 0.001 and L2 0.0001 using Burn operations.

## Retained requirements versus discarded machinery

Retain canonical game rules, recipient-local observations, required behavioral fixtures and the approved Burn/Rust learning contract. Keep policy weights separate from hidden simulator state and evaluation labels. The operator replaced the bespoke DIRECT work-unit budget with standard OS CPU/memory limits for one shared BOTH-seat job. Retain original S0+10s/S0+300s deadlines, final 3s cleanup and no renewed clock or budget after failure. A separately authorized one-container proof verified synthetic enforcement; concrete production limits and production admission remain unverified. See [native-job.md](native-job.md).

Do not migrate old Gate0 status generators, speculative kernel/bootstrap implementations, manual compiler/linker DAGs, sandbox-provisioning experiments, failed-attempt records or accumulated plan chronology. Existing private evidence stays where it is. No old operation grant is reused.

Runtime orchestration code grants no host-operation or production-training authority. Actual host isolation, installed inputs, execution, training and publication remain separate decisions when needed.

[gate-closure.md](gate-closure.md) maps the original Gate0/F9/R4 requirements to this rebuild. That historical matrix records all three gates as open; workspace integration does not reassess them. Executor selected proposal A, explicitly amending the current profile to supported-runtime trust and supervision rather than historical kernel/opened-object attestation. Estimator-only checks are superseded, not passed. The matrix separates Gate0 design acceptance, later runtime qualification, actual native proof and R4 implementation from training and product rollout. Workspace integration grants no new runtime policy, limits, recipe or execution approval.

The operator selected a newly versioned standard observation schema instead of exact V2 wire compatibility. `packages/contracts` uses pinned Zod 4.6.7 with native JSON Schema 2020-12 export and standard JSON serialization. Preserve visibility, lineage, paid receipts and economic conservation; do not carry old canonical codecs or compatibility walkers. The new boundary accepts JSON text, not arbitrary JavaScript DTO objects.

The operator selected TypeScript ownership of recipient handling, candidate generation and feature extraction. Rust owns scoring and learning. The bounded one-shot scoring executable uses standard JSON/Serde and hashes the exact Burn-native record bytes. It does not implement a daemon, renewed budget, startup clock, training process or second game engine.

The operator approved a newly versioned conventional observation/action encoding instead of preserving the old 418-coordinate meanings. Input dimension and checkpoint compatibility may change explicitly. Do not migrate the bespoke 7,501-state enemy-economic estimator or its frozen calibration tables. Preserve recipient knowledge, lineage, economic truths and the episodic objective. Do not fabricate balance/uncertainty values or zero-pad missing channels to claim extraction is complete.

The operator selected a small Burn MLP because a plain linear scorer of concatenated state/action vectors loses the shared state term under candidate softmax. The old linear scaffolding is replaced. The shared feature layout, model configuration, checkpoint hash and inference feature version now bind the actual representation to the model. See [representation.md](representation.md).

The operator separately approved replacing legacy candidate-selection quotas with a new bounded deterministic enumerator. `chess-coach.enumeration.v1` uses depth-cyclic FIFO expansion and per-prefix round-robin action generators, retaining pass, at most four actions, 512 candidates and 4,096 attempted extensions. This explicitly changes selection coverage without changing game legality. See [candidate-generation.md](candidate-generation.md).

The operator selected a new TypeScript/Zod causal-event journal rather than preserving old engine-provenance companion shapes. Preserve stable identities, action references, deployment dispositions, causal recipient visibility and `v1` state/journal identities through consolidation. Continuing side-local projection retains paid basis, explicit banks, target-only native consumption and causal casualty-memory ordering. Source-bound replay recomputes both recipients without a bespoke authorization registry. `packages/contracts`' `GameSession` remains the mineral-bank, paid-receipt and recipient-projection owner. Its approved target calls `starchess-core/causal-producer` begin/end wrappers around the same kernel as the product. Policy keeps recipient-local candidates and 2,271 features; Rust scoring and learning remain unchanged. See [causal-journal.md](causal-journal.md), [recipient-production.md](recipient-production.md), [provenance.md](provenance.md) and [resolution-primitives.md](resolution-primitives.md). Independent reference qualification remains separate.

This consolidation does not rerun or extend GPU qualification. Keep GPU mains disabled, masters 101–105, the v1 master-101 ordinal-0 identity, F64/C12, epsilon `1e-6`, absolute tolerance `1e-8`, relative tolerance `1e-5`, all 4,670 coordinates and the frozen Source23/seal6-derived records unchanged. No source/test pass establishes game-data training readiness or authorizes native execution, training or publication.

## Community references

- [Burn 0.22 linear layer](https://github.com/tracel-ai/burn/blob/v0.22.0/crates/burn-nn/src/modules/linear.rs): supported module, initialization and record APIs.
- [Burn custom training loops](https://burn.dev/books/burn/custom-training-loop.html): framework-owned gradients and optimizer steps.
- [OpenSpiel AlphaZero](https://openspiel.readthedocs.io/en/latest/alpha_zero.html): separate actors, learner and evaluators.
- [KataGo self-play](https://github.com/lightvector/KataGo/blob/master/SelfplayTraining.md): separate self-play, training, model export and evaluation roles.

These references guide architecture. Their defaults do not establish our reproducibility, economic bounds or host verification.

## Current consolidation verification — scoped Bun PASS

This section retains its heading and receipt links for existing citations. Its results describe the pre-relocation consolidation snapshot, not fresh verification of **Move tests; retire shim**.

Executor restricts task verification to Bun or Rust; do not introduce Python invocations. That source-only pass granted no native execution. `tooling/tests/workspace-integration.test.ts` contained eight Bun tests for workspace boundaries and active architecture coverage. `artifacts/engine-consolidation/run_check.ts` was its repository-owned TypeScript runner. It used `Bun.spawn` for Bun-hosted JS/TS tests, type checks and source-boundary checks, captured source pins before and after each invocation, and retained stdout, stderr and a receipt. A successful check also required matching source pins. `packages/starchess-core/tsconfig.integration-tests.json` included the consolidation regression suite without replacing the product source config.

The post-codec Bun-only run records all **13 gates PASS** in [bun-final-2/summary.json](../artifacts/engine-consolidation/checks/bun-final-2/summary.json). Each check records exit code 0, `status: PASS` and `sourcePinsMatch: true`; its sibling receipt retains the before/after pins and complete command output.

| Suite | Tests | Files | Bun expect calls |
|---|---:|---:|---:|
| Core | 432 | 53 | — |
| Arena | 24 | 6 | — |
| App | 790 | 110 | — |
| Selected pure ML | 410 | 45 | 17,629 |
| Workspace | 8 | 1 | 913 |

The run passed **1,664 tests** in total. Seven strict TypeScript gates passed for ML source/tests, core source/regression tests, arena, server and app. The app dependency-boundary gate also passed. These are scoped source-regression results, not native/runtime/training qualification. The lead reports adversarial and security findings closed with source READY; those read-only reviews did not execute tests.

Preserve historical receipts and their original source pins. This run performed no native Rust/GPU execution, training, dependency re-acquisition or publication; GPU mains remain disabled and the frozen math/schema/dependency boundaries retain their accepted scope. Its Bun static header/index/note-bound checks are likewise historical; new layout/static receipts must follow the final edits. Full remote-theme/native PlantUML rendering remains unverified after Bun-only steering. Earlier offline theme-stripped syntax evidence remains historical, not proof of current full-theme rendering.

## Historical verification

Historical clean-rebuild verification recorded 345 Bun tests across 40 files with 16,703 assertions, plus strict TypeScript checks of source and tests. The Rust foundation previously passed 24 tests, formatting and Clippy with warnings denied. Recorded reference expectations cover queue/collision primitives, 122,160 classical cases and 11,045 full-turn outcomes. The actual journal sink preserves those full-turn outcomes. That pass's privacy/economic/replay fixtures used actual mutations rather than transferred historical PASS results. Continuing hidden-state twins passed through real enumeration/encoding and frozen native Burn scoring with a synthetic checkpoint. Pinned TypeScript closure tests rejected producer reachability through runtime/type/reexport paths, host imports, unresolved modules and dynamic loading. These historical results do not establish fresh verification of the integrated workspace. Third-party/native/runtime qualification remains separate. See [verification.md](verification.md) for the persisted test index and scope limits.

Under explicit development approval, that historical pass used Rust 1.95.0 and installed Zig 0.15.2 through temporary `zig cc`, `zig c++` and `zig ar` drivers under `/tmp/opencode/chess-coach-ii-zig-IklsS5/`. Standard Cargo/CC environment variables selected these drivers; no compiler machinery entered the repository. The pass recorded public Cargo cache and earlier logs under `/tmp/opencode/chess-coach-ii-cargo-leCrjy/`. That pass created both lockfiles. Cargo's optional backend/platform entries are not a selected compilation or runtime inventory. Public npm resolution used an anonymous home with lifecycle scripts disabled.

That historical pass recorded native syntax checking and SVG rendering for sixteen diagrams in `/tmp/opencode/chess-coach-ii-causal-diagrams-lg_n5r3d/`. Local Markdown links, documentation whitespace and transient planning-RAM removal received separate checks. The causal/recipient source pass reran Bun and strict TypeScript, not the unchanged Rust suites. One earlier authorized synthetic Docker proof passed and cleaned up its container in 7476.106 ms total. Its grant is consumed. The separately authorized C3 metadata queries also completed; that grant is consumed. No new host/runtime operation occurred during that source verification. These checks do not establish training readiness, production admission or product completeness. That pass performed no game-data training, deployment, commit or publication.
