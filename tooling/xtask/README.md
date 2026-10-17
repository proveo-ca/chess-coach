# Rust native-runner gate

Run `cargo xtask check` from the workspace.

The fixed gate validates the native baseline runner and retained synthetic compatibility controls.
It does not admit a learned model or authorize training.
It does not install dependencies, invoke Bun, or start reviews.
Cargo commands use frozen, offline resolution and two build jobs.
Each command has a 600-second deadline, including three seconds reserved for process cleanup.

Receipts and raw stdout/stderr logs use a fresh directory outside the repository.
`TRAINING_RECEIPT_PARENT` selects its existing parent; the default uses the OS temporary directory.
Unix receipt directories use mode `0700`; files use `0600`.
Failures retain actual exit codes, Unix signals, timeout flags, elapsed time and validation errors.
Only a complete fixed invoice with unchanged inputs sets `reviewEligible=true`.

The SHA-256 identity frames each sorted relative path and its file bytes with unsigned 64-bit big-endian lengths.
It includes the Rust crates, Node engine sources/tests/configuration, core regression sources/configuration, legacy public differential-oracle sources, root manifests, dependency locks, Cargo configuration, toolchain configuration, root TypeScript configurations, both owner diagrams and the spec index.
Recursive collection detects source additions, deletions, renames and byte changes.
It rejects input symlinks.
It excludes Markdown documentation, `target`, `node_modules`, `.generated` and `.git`.
It does not bind downloaded theme bytes or claim hermetic PlantUML rendering.

New owner diagrams and index entries use identical literal `covers` paths.
Covered Rust/TypeScript files carry top-line pointers back to their owner.
The same pointer check covers the test-only MJS oracle.
The gate preserves the existing 43 index entries and unresolved metadata.
It does not require historical unresolved pointers to resolve.
Both owner diagrams must pass syntax checks and produce bounded SVGs in private receipt subdirectories.

The Rust invoice requires nonempty compatibility, contract, composition, policy, runner, schedule and replay integration targets.
The source inventory requires all four v2 Node control files.
Tracked and untracked legacy-source, consumer, contract, corpus and evidence changes fail checks before and after verification.
