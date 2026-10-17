# Rust arena and native engine adapter

Spec: [`_spec/apps/arena/burn-compat.puml`](../../_spec/apps/arena/burn-compat.puml).

Rust owns candidate composition, baseline selection, match orchestration, scheduling and replay verification.
The fixed Node adapter owns the unchanged TypeScript engine.
The separate compatibility smoke retains its synthetic Burn scorer.

The bounded native baseline passed the whole-workspace gate and all three closing reviews.
Contract: [`_spec/ml/native-runner.md`](../../_spec/ml/native-runner.md).

## Native commands

Run from the repository root with Rust 1.95.0, Node 22+ and the workspace's pnpm dependencies:

```sh
cargo run --frozen --offline -p arena -- run --config /path/to/match.json
cargo run --frozen --offline -p arena -- suite --config /path/to/suite.json --out /path/to/fresh-results
cargo run --frozen --offline -p arena -- replay --record /path/to/fresh-results/case-0000.json
```

Match configuration:

```json
{
  "version": "arena-match-v1",
  "caseId": "tiny-pass",
  "fixture": "tiny-v1",
  "players": { "w": "pass-v1", "b": "pass-v1" },
  "environmentSeed": 0,
  "policySeeds": { "w": 1, "b": 2 },
  "maxWindows": 45
}
```

Suite configuration:

```json
{
  "version": "arena-schedule-v1",
  "fixtures": ["tiny-v1", "standard-v1"],
  "pairings": [{ "w": "pass-v1", "b": "pass-v1" }],
  "repeats": 1,
  "environmentSeed": 0,
  "policySeed": 1,
  "maxWindows": 45
}
```

Fixtures are `tiny-v1`, `standard-v1` and `all-actors-v1`.
Selectors are `pass-v1`, `first-v1` and `seeded-v1`.
`first-v1` includes pass in canonical ordering; it is not a strength baseline.
Fixed fixtures report `environmentSeedUsed:false`.
Schedules contain at most 64 cases, with at most 16 repeats and 45 windows per case.

Both seats select before native admission.
Native rejection ends a run without a replacement queue.
Only native terminal outcomes count toward W/D/L after independent replay.
Shorter host limits report `window-limit`, not a draw.
Reports retain `assurance:NON_ADMITTED`, `learned:false` and `modelArtifact:null`.
`fullRunner:true` describes multi-window capability, not training readiness.

The v2 worker uses bounded NDJSON with 64 KiB requests, 1 MiB replies and 64 KiB retained stderr.
Its match budget is 300 seconds, including three seconds for cleanup.
Each decision has one absolute ten-second budget.
Config reads are bounded to 64 KiB; record reads and serialization are bounded to 16 MiB.
Suite output requires a fresh private directory outside protected legacy, corpus and evidence paths.

## Compatibility smoke

Use the workspace Rust 1.95 toolchain and install the workspace's pinned Node dependencies before running.
Run these commands from the repository root:

```sh
cargo run --frozen -p arena -- smoke
cargo run --frozen -p arena -- --help
cargo test --frozen -p arena
cargo clippy --frozen -p arena --all-targets -- -D warnings
```

The compiled `target/debug/arena smoke` binary emits one JSON line and exits `0`.
The `smoke` command accepts no trailing arguments.
Missing, unknown, or trailing arguments exit `2` with stderr output.
Smoke runtime errors exit `1` without a JSON report.
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

Deferred: economic belief/features, training readiness, real training, profiling, learned artifacts and final legacy cleanup.
