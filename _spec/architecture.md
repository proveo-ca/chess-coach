# Clean rebuild

## Goal

Rebuild around maintained community interfaces instead of carrying the previous experimental infrastructure forward.

The original branch remains the read-only behavior reference at `b4b241481fb12de4a7344e6dba8eda775af57675`. The new branch starts without its commit ancestry, tooling or design-history tree.

## Component boundaries

| Component | Responsibility | Current state |
|---|---|---|
| `packages/game-core` | Canonical physics, legal actions and actual causal effects | Init, queues, B/C/F settlement, stable private identities and actual-mutation journal implemented |
| `packages/contracts` | Recipient-local observations, economic data ownership and deterministic source replay | Standard journal/batch/observation schemas, continuing producer, explicit banks/receipts, atomic BOTH data successors and replay implemented |
| `packages/policy` | Recipient-local candidate enumeration and observation/action encoding | New bounded enumerator and 2,271-coordinate encoder implemented |
| `crates/learning` | Burn model, episodic objective, gradients, optimizers and native model records | Standard 2271->32->1 MLP; synthetic tests pass |
| `crates/policy-io` | Frozen native-checkpoint scoring through standard JSON/Serde process I/O | Native and cross-language synthetic e2e verified with actual versioned encoding |
| Rollout/evaluation harness | Seeded games, bounded queues, immutable model versions and comparison | Not implemented |
| Product applications | Existing game/coaching interactions and platform entrypoints | Migration pending |

Migrate a component only when its consumer, retained behavior and regression tests justify it. Do not copy obsolete experiments merely to satisfy a historical import path. Preserve game behavior rather than the previous workspace layout.

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

The current branch implements no runtime authority or admission mechanism. Actual host isolation, installed inputs, execution, training and publication remain separate decisions when needed.

[gate-closure.md](gate-closure.md) maps the original Gate0/F9/R4 requirements to this rebuild. All three gates remain open. Executor selected proposal A, explicitly amending the current profile to supported-runtime trust and supervision rather than historical kernel/opened-object attestation. Estimator-only checks are superseded, not passed. The matrix separates Gate0 design acceptance, later runtime qualification, actual native proof and R4 implementation from training and product rollout. Exact runtime policy, limits, recipe and execution approvals remain open.

The operator selected a newly versioned standard observation schema instead of exact V2 wire compatibility. `packages/contracts` uses pinned Zod 4.6.7 with native JSON Schema 2020-12 export and standard JSON serialization. Preserve visibility, lineage, paid receipts and economic conservation; do not carry old canonical codecs or compatibility walkers. The new boundary accepts JSON text, not arbitrary JavaScript DTO objects.

The operator selected TypeScript ownership of recipient handling, candidate generation and feature extraction. Rust owns scoring and learning. The bounded one-shot scoring executable uses standard JSON/Serde and hashes the exact Burn-native record bytes. It does not implement a daemon, renewed budget, startup clock, training process or second game engine.

The operator approved a newly versioned conventional observation/action encoding instead of preserving the old 418-coordinate meanings. Input dimension and checkpoint compatibility may change explicitly. Do not migrate the bespoke 7,501-state enemy-economic estimator or its frozen calibration tables. Preserve recipient knowledge, lineage, economic truths and the episodic objective. Do not fabricate balance/uncertainty values or zero-pad missing channels to claim extraction is complete.

The operator selected a small Burn MLP because a plain linear scorer of concatenated state/action vectors loses the shared state term under candidate softmax. The old linear scaffolding is replaced. The shared feature layout, model configuration, checkpoint hash and inference feature version now bind the actual representation to the model. See [representation.md](representation.md).

The operator separately approved replacing legacy candidate-selection quotas with a new bounded deterministic enumerator. `chess-coach.enumeration.v1` uses depth-cyclic FIFO expansion and per-prefix round-robin action generators, retaining pass, at most four actions, 512 candidates and 4,096 attempted extensions. This explicitly changes selection coverage without changing game legality. See [candidate-generation.md](candidate-generation.md).

The operator selected a new TypeScript/Zod causal-event journal rather than preserving old engine-provenance companion shapes. Actual-mutation integration now preserves stable identities, action references, deployment dispositions and causal recipient visibility. Continuing side-local projection retains paid basis, explicit banks, target-only native consumption and causal casualty-memory ordering. Source-bound replay recomputes both recipients without a bespoke authorization registry. See [causal-journal.md](causal-journal.md), [recipient-production.md](recipient-production.md), [provenance.md](provenance.md) and [resolution-primitives.md](resolution-primitives.md). Runtime-owned sessions and independent reference qualification remain pending.

## Community references

- [Burn 0.22 linear layer](https://github.com/tracel-ai/burn/blob/v0.22.0/crates/burn-nn/src/modules/linear.rs): supported module, initialization and record APIs.
- [Burn custom training loops](https://burn.dev/books/burn/custom-training-loop.html): framework-owned gradients and optimizer steps.
- [OpenSpiel AlphaZero](https://openspiel.readthedocs.io/en/latest/alpha_zero.html): separate actors, learner and evaluators.
- [KataGo self-play](https://github.com/lightvector/KataGo/blob/master/SelfplayTraining.md): separate self-play, training, model export and evaluation roles.

These references guide architecture. Their defaults do not establish our reproducibility, economic bounds or host verification.

## Verification

The Bun suite contains 345 tests across 40 files with 16,703 assertions. Strict TypeScript checks source and tests. The unchanged Rust foundation previously passed 24 tests, formatting and Clippy with warnings denied. Recorded reference expectations cover queue/collision primitives, 122,160 classical cases and 11,045 full-turn outcomes. The actual journal sink preserves those full-turn outcomes. Current privacy/economic/replay fixtures use actual mutations rather than transferred historical PASS results. Continuing hidden-state twins pass through real enumeration/encoding and frozen native Burn scoring with a synthetic checkpoint. Pinned TypeScript closure tests reject producer reachability through runtime/type/reexport paths, host imports, unresolved modules and dynamic loading. Third-party/native/runtime qualification remains separate. See [verification.md](verification.md) for the persisted test index and scope limits.

Under explicit development approval, this realm uses Rust 1.95.0 and installed Zig 0.15.2 through temporary `zig cc`, `zig c++` and `zig ar` drivers under `/tmp/opencode/chess-coach-ii-zig-IklsS5/`. Standard Cargo/CC environment variables select these drivers; no compiler machinery enters the repository. Public Cargo cache and earlier logs remain in `/tmp/opencode/chess-coach-ii-cargo-leCrjy/`. Both lockfiles are new. Cargo's optional backend/platform entries are not a selected compilation or runtime inventory. Public npm resolution uses an anonymous home with lifecycle scripts disabled.

All sixteen diagrams pass native syntax checking and SVG rendering in `/tmp/opencode/chess-coach-ii-causal-diagrams-lg_n5r3d/`. Local Markdown links, documentation whitespace and transient planning-RAM removal receive separate checks. The causal/recipient source pass reruns Bun and strict TypeScript, not the unchanged Rust suites. One earlier authorized synthetic Docker proof passed and cleaned up its container in 7476.106 ms total. Its grant is consumed. The separately authorized C3 metadata queries also completed; that grant is consumed. No new host/runtime operation occurred during source verification. These checks do not establish training readiness, production admission or product completeness. No game-data training, deployment, commit or publication occurred.
