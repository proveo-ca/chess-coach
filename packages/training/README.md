# Rust training foundations

This private crate retains the synthetic CPU `f64` path with Burn `0.22.0`.
Rust contracts, candidate composition and baseline selectors support the native arena delivery.
It does not implement the full learner or the historical 418-feature encoder.
The [compatibility plan](../../_spec/_plans/burn-flex-compat.md) records the earlier bounded milestone.
The [native-runner contract](../../_spec/ml/native-runner.md) records the completed bounded baseline delivery.

The bounded native baseline passed the whole-workspace gate and all three closing reviews.

## Library boundaries

- `contracts`: closed authorized views, seven action families and complete canonical action-array keys.
- `candidates`: profile-B composition with native planning helpers supplied through `PlanningOracle`.
- `policy`: `pass-v1`, `first-v1` and integer-seeded `seeded-v1` selectors, including pass.
- `score_synthetic_f64`: the retained fixed Burn model, not a learned arena policy.
- `protocol`: the standalone numerical compatibility surface.

Composition limits are four actions, 2048 attempted extensions and 512 retained candidates including pass.
Node supplies native geometry, append failures, anchors and one-action costs.
Rust owns composition, reservations, canonical identity and cumulative spend.

## Preparation

Rust owns the learner, arena, tests, and verification.
Node hosts only the adapter to the existing TypeScript engine.
Use pnpm to install that adapter and existing JavaScript workspaces.
Provision Rust `1.95.0` with rustfmt and Clippy through mise or rustup.
A native C linker is required; a scoped Zig `0.15.2` compiler also works.
Set Cargo's target linker and `CC` to your Zig C wrapper when the host lacks a toolchain.
Do not place machine-specific tool paths in the repository.

```sh
pnpm install --frozen-lockfile
cargo fetch --locked
cargo xtask check
cargo run --frozen -p arena -- smoke
```

The gate builds the Rust workspace before integration tests.
Oxlint and tsgo check the thin Node engine adapter and all its tests.
The existing engine retains its own strict compiler profile.

The arena calls this Rust library directly.
The Node adapter accepts only versioned fixed fixture identities and native action data.
It never loads model paths, runs Cargo, installs dependencies, or substitutes JavaScript scoring.
Framework tensor operations, autodiff, SGD, and Burnpack supply the numerical implementation.
Only synthetic Rust tests update fixture weights.

`cargo xtask check` retains logs and a source-bound receipt in a fresh temporary directory.
Set `TRAINING_RECEIPT_PARENT` to select an existing receipt parent.
All required checks must pass before reviewers become eligible.
Python is absent from our implementation; upstream dependencies may use it.
