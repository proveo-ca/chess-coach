# Rust feature-seams gate

Run `cargo xtask check` from the workspace.

The fixed gate validates checked feature-input seams, pure native geometry helpers and exact 418-field metadata alongside the economic ledger, native baseline runner and retained synthetic compatibility controls.
It does not admit a learned model or authorize training.
It does not install dependencies, invoke Bun, or start reviews.
Cargo commands use frozen, offline resolution and two build jobs.
The Node preflight requires version 22+ and the actual `node:module.registerHooks` capability used by the native-delegate instrumentation tests.
The verified toolchain uses Node `22.23.2`; older Node 22 builds without that capability fail preflight.
Each command has a 600-second deadline, including three seconds reserved for process cleanup.

Receipts and raw stdout/stderr logs use a fresh directory outside the repository.
`TRAINING_RECEIPT_PARENT` selects its existing parent; the default uses the OS temporary directory.
Unix receipt directories use mode `0700`; files use `0600`.
Failures retain actual exit codes, Unix signals, timeout flags, elapsed time and validation errors.
Only a complete fixed invoice with unchanged inputs sets `reviewEligible=true`.
Both normal and initialization-failure receipts use `rust-training-verification-v4`, scope `native-feature-seams`.
The fixed `notEstablished` list excludes full training closure, genuine native authority, whole-decision adequacy, calibration and training readiness from this verification claim.

The SHA-256 identity frames each sorted relative path and its file bytes with unsigned 64-bit big-endian lengths.
It includes the Rust crates, Node engine sources/tests/configuration, core regression sources/configuration, legacy public differential-oracle sources, root manifests, dependency locks, Cargo configuration, toolchain configuration, root TypeScript configurations, both owner diagrams and the spec index.
Recursive collection detects source additions, deletions, renames and byte changes.
It rejects input symlinks.
It excludes Markdown documentation, `target`, `node_modules`, `.generated` and `.git`.
It does not bind downloaded theme bytes or claim hermetic PlantUML rendering.

The two existing owner diagrams and index entries use identical literal `covers` paths.
Covered Rust/TypeScript files carry top-line pointers back to their owner.
The same pointer check covers the test-only MJS oracle.
The gate preserves the existing 43 index entries and unresolved metadata.
It does not require historical unresolved pointers to resolve.
Both owner diagrams must pass syntax checks and produce bounded SVGs in private receipt subdirectories.

The Rust invoice requires nonempty compatibility, contract, composition, policy, runner, schedule, replay, ledger-contract, ledger-history, feature-input, feature-manifest, economic-reconstruction and readiness integration targets.
Required target checks match complete source-path tokens; binary-name and summary counts must agree.
The source inventory requires all four v2 Node controls, all three economic-worker controls and the ten F1 source/test/fixture inputs.
The metadata oracle executes a fixed test-only MJS reader against the actual legacy production API.
Runtime tests and engine lint check that reader; tsgo does not include MJS files.
The geometry-only import restriction permits only the native `planning-v1` surface.
An isolated linter regression checks the actual configuration with allowed and forbidden imports.
Ledger diagnostics do not certify policy selection, full feature semantics, calibration, learner software or training readiness.
Tracked and untracked legacy-source, consumer, contract, corpus and evidence changes fail checks before and after verification.
