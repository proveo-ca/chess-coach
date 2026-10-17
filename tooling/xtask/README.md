# Rust compatibility gate

Run `cargo xtask check` from the workspace.

The fixed gate validates synthetic compatibility only.
It does not admit a model or certify a full match runner.
It does not install dependencies, invoke Bun, or start reviews.
Cargo commands use frozen, offline resolution and two build jobs.
Each command has a 600-second deadline.

Receipts and raw stdout/stderr logs use a fresh directory outside the repository.
`TRAINING_RECEIPT_PARENT` selects its existing parent; the default uses the OS temporary directory.
Unix receipt directories use mode `0700`; files use `0600`.
Failures retain actual exit codes, Unix signals, timeout flags, elapsed time and validation errors.
Only a complete fixed invoice with unchanged inputs sets `reviewEligible=true`.

The SHA-256 identity frames each sorted relative path and its file bytes with unsigned 64-bit big-endian lengths.
It includes the new Rust crates, Node engine sources/tests/configuration, core regression sources/configuration, root manifests, dependency locks, Cargo configuration, toolchain configuration, root TypeScript configurations, both owner diagrams and the spec index.
Recursive collection detects source additions, deletions, renames and byte changes.
It rejects input symlinks.
It excludes Markdown documentation, `target`, `node_modules`, `.generated` and `.git`.
It does not bind downloaded theme bytes or claim hermetic PlantUML rendering.

New owner diagrams and index entries use identical literal `covers` paths.
Covered Rust/TypeScript files carry top-line pointers back to their owner.
The gate preserves the existing 43 index entries and unresolved metadata.
It does not require historical unresolved pointers to resolve.
