# Chess Coach

Clean rebuild on `feat-ml-adjuntant-ii`.

## Foundation

- Rust + Cargo for machine learning.
- Burn 0.22 with its `Module`, `nn::Linear`, optimizer and native record APIs.
- Flex CPU reference/tests; required F64 GPU learning remains unqualified.
- No custom compiler, linker, kernel patch or bootstrap framework.
- Bun/TypeScript for the canonical game integration and application tooling.

The learning crate uses a standard Burn MLP and episodic objective. `packages/game-core` supplies canonical initialization, native rules, gas-aware queue edits, complete B/C/F physics and an actual-mutation causal journal. Host-only `packages/contracts` entrypoints produce continuing recipient observations, retain side-local identities and paid receipts, own explicit banks and support deterministic source-bound replay. Standard JSON/Zod schemas validate observations, journals, public batches, candidates and inference messages. `packages/policy` enumerates bounded recipient-local candidates and encodes 2,271 observation/action coordinates without a custom enemy-economic estimator. `crates/policy-io` binds model configuration, feature version and native checkpoint identity before scoring. Supervised independent-reference runtime qualification, integrated episode admission/learning, rollout/evaluation and product applications remain pending. This is not a trained model or a production-readiness claim.

## Host entrypoint

Run `mise run host:preflight --confirm-host` **on the actual host**, not in this coding sbx, to capture the existing mise/sbx executable identities and `sbx --help`.
Automatic installation stays disabled.
This metadata-only task provisions nothing and authorizes no training.
After root-help discovery, `mise run host:sbx-contract --confirm-host` collects only six fixed subcommand help pages.
The selected learning target is a shared-GPU host Docker job with host-backed state; this coding agent stays in sbx.
`mise run host:admission-facts --confirm-host` collects bounded host CPU/RAM/GPU and selected-filesystem metadata without creating anything.
Actual F64 GPU scoring/learning remains required and unqualified; CPU Flex is the verified reference/test path.
Seeding/provisioning/training tasks remain unwired until the actual Docker/GPU runtime, host targets and separate grants exist.
See [_spec/host-entrypoint.md](_spec/host-entrypoint.md).

## Development checks

Use the versions pinned in `mise.toml` and a standard native build toolchain. On GNU/Linux, Rust also needs a C compiler/linker and development libraries. Automatic installation remains disabled.

```sh
MISE_AUTO_INSTALL=false mise exec -- cargo fmt --all -- --check
MISE_AUTO_INSTALL=false mise exec -- cargo build --workspace --all-targets --locked --offline --jobs 2
MISE_AUTO_INSTALL=false mise exec -- cargo test --workspace --all-targets --locked --offline --jobs 2
MISE_AUTO_INSTALL=false mise exec -- cargo clippy --workspace --all-targets --locked --offline --jobs 2 -- -D warnings
MISE_AUTO_INSTALL=false mise exec -- bun --no-env-file --no-install test packages/game-core/tests packages/contracts/tests packages/policy/tests packages/runtime/tests
MISE_AUTO_INSTALL=false mise exec -- bun --no-env-file --no-install run --bun typecheck
```

Include `packages/runtime/tests` in the Bun suite for private protocol, synthetic native learner, SQL checkpoint and lifecycle fixtures.
Run `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tooling/runtime/tests -v` for fake-manager, read-only fake-cgroup and bounded evidence-writer checks.
Those suites authorize no Docker operation or gameplay/training run.

Dependency resolution and compilation must succeed before Rust verification can be claimed. No dependency installation, game-data collection or training run follows from creating this workspace.

Build Rust binaries and examples before the Bun process e2e test. Rust verification uses Rust 1.95.0 and an explicitly approved temporary Zig C driver outside this repository. TypeScript 5.9.3 checks source and tests separately. See [_spec/verification.md](_spec/verification.md) for results and scope limits.

See [_spec/architecture.md](_spec/architecture.md) for the migration boundary and reference designs.

See [_spec/gate-closure.md](_spec/gate-closure.md) for the open Gate0/F9/R4 acceptance matrix, explicit contract decision and closure critical path.
