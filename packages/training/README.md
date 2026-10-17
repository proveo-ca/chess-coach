# Burn compatibility milestone

This private workspace proves a synthetic CPU `f64` path with Burn `0.22.0`.
It does not implement the full trainer or the historical 418-feature encoder.
The [plan](../../_spec/_plans/burn-flex-compat.md) records the boundary and deferred replacement.

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

The arena calls the training library directly.
The Node adapter accepts only the fixed engine fixture and native action data.
It never loads model paths, runs Cargo, installs dependencies, or substitutes JavaScript scoring.
Framework tensor operations, autodiff, SGD, and Burnpack supply the numerical implementation.
Only synthetic Rust tests update fixture weights.

`cargo xtask check` retains logs and a source-bound receipt in a fresh temporary directory.
Set `TRAINING_RECEIPT_PARENT` to select an existing receipt parent.
All required checks must pass before reviewers become eligible.
Python is absent from our implementation; upstream dependencies may use it.
