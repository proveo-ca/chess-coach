# Arena Rust / Node compatibility smoke

Spec: [`_spec/apps/arena/burn-compat.puml`](../../_spec/apps/arena/burn-compat.puml).

This Rust crate implements one **synthetic, NON_ADMITTED** planning window.
It does not implement the full arena runner or a learned policy.

## Run

Use the workspace Rust 1.95 toolchain and install the workspace's pinned Node dependencies before running.
Run these commands from the repository root:

```sh
cargo run --frozen -p arena -- smoke
cargo run --frozen -p arena -- --help
cargo test --frozen -p arena
cargo clippy --frozen -p arena --all-targets -- -D warnings
```

The compiled `target/debug/arena smoke` binary emits one JSON line and exits `0`.
Only `smoke`, `--help`, and `-h` are valid single arguments.
Missing, unknown, or trailing arguments exit `2` with stderr output.
Runtime errors exit `1` without a JSON report.
The binary does not run Cargo, install JavaScript packages, or load environment files.

## Boundary

Rust launches the fixed `engine/worker.ts` twice with `node --import tsx`.
Each one-shot invocation reconstructs the same two-king native fixture.
The `open` request returns only the white-side observation.
Rust validates closed typed DTOs, 64 canonical cells, resource bounds, own-piece agreement, and sorted own mine multiplicity.
Candidate generation uses only the observed own king and lit empty `d1`/`f1` destinations.
Each f64 feature row contains destination file/rank and 416 zeros.
Rust calls `training_native::score_synthetic_f64` directly.
The fixed synthetic scorer returns `1.875` and `2.875`.
Selection preserves the original candidate index and breaks ties with the canonical JSON action key.

The `settle` request contains only the selected action and fixed fixture identity.
Node owns native admission, black's explicit pass, resolution, and one income application.
Rust verifies the reconstructed observation, requested actions, unchanged committed bank, and fixture bank transition `3 → 4` for both sides.
Native SCFEN and opaque raw engine results enter the host report, not the scorer.

Every report declares `milestone: "burn-flex-compat-v1"`, `scope: "synthetic"`, `assurance: "NON_ADMITTED"`, `fullRunner: false`, and `modelArtifact: null`.

## Process limits

The Linux/Unix bridge resolves Node from the trusted host's absolute `PATH` entries.
Child processes inherit only `PATH`.
The bridge sends one JSON request followed by EOF and requires one newline-terminated JSON reply.
Limits per child are stdin `64 KiB`, stdout `1 MiB`, stderr `64 KiB`, and total lifecycle `30 s` including a `3 s` kill/reap reserve.
Nonblocking Unix socket pairs multiplex all three standard streams without reader threads or unbounded joins.
Overflow, timeout, malformed replies, mismatched identity/phase, and nonzero exit statuses fail closed.
The built-in adapter is trusted host code, not a sandbox for malicious code or descendants.

## Verification

Rust unit tests cover DTO closure, square grammar, observation invariants, mine multiplicity, synthetic features, deterministic selection, process bounds, environment isolation, and child cleanup.
`tests/smoke.rs` invokes the actual Rust binary and Burn scorer, compares every engine-result field with an independent native Node replay, and checks deterministic reports and CLI failures.
The Node adapter retains its separate static checks and native tests.

Deferred: the full runner, real training data, profiling, learned models, scheduling/replay infrastructure, and legacy cleanup.
