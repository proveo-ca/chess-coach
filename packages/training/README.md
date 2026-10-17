# Rust training foundations

This private crate retains the synthetic CPU `f64` path with Burn `0.22.0`.
Rust contracts, candidate composition and baseline selectors support the native arena delivery.
It does not implement the full learner or the historical 418-feature encoder.
The [compatibility plan](../../_spec/_plans/burn-flex-compat.md) records the earlier bounded milestone.
The [native-runner contract](../../_spec/ml/native-runner.md) records the completed bounded baseline delivery.

The published native baseline passed its matching-source gate and all three closing reviews.
The ledger has a separate [verification and closing-review record](../../_spec/_plans/native-economic-ledger.md).
The baseline receipts do not verify the ledger.

## Library boundaries

- `contracts`: closed authorized views, seven action families and complete canonical action-array keys.
- `candidates`: profile-B composition with native planning helpers supplied through `PlanningOracle`.
- `policy`: `pass-v1`, `first-v1` and integer-seeded `seeded-v1` selectors, including pass.
- `ledger`: strict economic boundaries, atomic recipient histories and paid-basis conservation.
- `score_synthetic_f64`: the retained fixed Burn model, not a learned arena policy.
- `protocol`: the standalone numerical compatibility surface.

Composition limits are four actions, 2048 attempted extensions and 512 retained candidates including pass.
Node supplies native geometry, append failures, anchors and one-action costs.
Rust owns composition, reservations, canonical identity and cumulative spend.

## Ledger foundation

The [ledger contract](../../_spec/ml/native-economic-ledger.md) defines the bounded ledger delivery.
The new `ledger` module owns closed economic DTOs, durable own-unit/mine identities, authorized observations and exact paid-basis accounting.
Native helpers supply rule defaults, costs, income entitlement and causal facts.
Rust does not duplicate native income or movement rules.
The explicit settlement thresholds are **turn 1 → 1**, **turn 11 → 2**, and **turn 21 → 3** nominal minerals per seat and next-turn gas capacity.
Turn-0 initialization grants nothing.
A game-ending turn-start check opens no next playable turn or additional settlement grant; its raw final snapshot belongs to separate preservation regressions, not the normal income schedule.
Own paid investment, non-CC replacement value and native unit cost remain distinct.
Enemy sightings and witnessed destruction do not establish exact enemy inventory or spending.

One ledger-work allowance covers both recipients in each reconstructed window.
Initial history belongs to the first window's allowance.
RPCs and helper calls cannot renew that allowance.
This bounds ledger work, not the deferred full-feature training decision.
Economic verification does not certify policy selection or learner readiness.
The arena's separate verified-terminal closeout excludes unused actual credit without changing these raw histories.
Full418 features, posterior/promotion kernels, learner software and calibration remain deferred.

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
