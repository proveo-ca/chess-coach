# Rust arena and native engine adapter

Spec: [`_spec/apps/arena/burn-compat.puml`](../../_spec/apps/arena/burn-compat.puml).

Rust owns candidate composition, baseline selection, match orchestration, scheduling and replay verification.
The fixed Node adapter owns the unchanged TypeScript engine.
The separate compatibility smoke retains its synthetic Burn scorer.

The published native baseline passed its matching-source gate and all three closing reviews.
Contract: [`_spec/ml/native-runner.md`](../../_spec/ml/native-runner.md).
The ledger foundation has its own [verification and closing-review record](../../_spec/_plans/native-economic-ledger.md).
The baseline receipts do not verify the ledger.

## Native commands

Run from the repository root with Rust 1.95.0, Node 22+ and the workspace's pnpm dependencies:

```sh
cargo run --frozen --offline -p arena -- run --config /path/to/match.json
cargo run --frozen --offline -p arena -- suite --config /path/to/suite.json --out /path/to/fresh-results
cargo run --frozen --offline -p arena -- replay --record /path/to/fresh-results/case-0000.json
cargo run --frozen --offline -p arena -- ledger --record /path/to/fresh-results/case-0000.json
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

## Economic ledgers

Contract: [`_spec/ml/native-economic-ledger.md`](../../_spec/ml/native-economic-ledger.md).
The selected delivery adds `arena ledger --record /path/to/record.json`.
It reconstructs native consequences from a fixed fixture in one independent provenance pass.
Rust owns the ledger calculations and durable own-unit/mine identities.
Node supplies native rule facts and recipient-filtered causal events.

| Ledger | Meaning |
| --- | --- |
| Calculated | Actual initial endowment, equal scheduled income entitlement, own capped credits, spending and gas budgets. |
| Seen | Current authorized enemy material and separate dated last-seen square assertions. |
| Witnessed enemy destruction | Confirmed causal observations, with own-source-action attribution kept separate from killer ownership. |
| Own lost | Exact own retirements, paid basis and replacement value; paid deployment waste remains separate. |

Native turn, planning window and settlement/grant counters stay separate.
Gas refills as capacity rather than accumulating as wealth.

Normal playable-turn economics:

| Turns | Nominal minerals per settlement, each seat | Gas refill capacity |
| --- | ---: | ---: |
| **1–10** | **1** | **1** |
| **11–20** | **2** | **2** |
| **21–45** | **3** | **3** |

All three settlement thresholds require explicit controls:

| Settlement crossing | Nominal minerals per seat | Next gas capacity |
| --- | ---: | ---: |
| 0 → **1** | 1 | 1 |
| 10 → **11** | 2 | 2 |
| 20 → **21** | 3 | 3 |

The turn-0 fixture supplies initial endowment, not an income grant.
Mineral credits occur only at settlement and remain bank-cap limited.
A game-ending turn-start check opens no next playable turn and creates no additional settlement grant.
For verified terminals, `terminalTrainingCloseout` excludes the matching unused actual mineral credit and declares zero usable gas.
Raw ledgers, native outcomes, playable features and frozen estimator labels remain unchanged.
Window limits, rejection and uncertain prefixes receive no terminal closeout.

Fog disappearance never establishes a capture or loss.
Repeated sightings never establish distinct enemy identities.
Analysis starts at the record's initial state; zero endowed paid basis makes no claim about earlier purchases.

Ledger verification checks native consequences, not policy selection.
Use `arena replay` for the separate native-and-policy proof.
Native rejection or uncertain mutation produces an explicit verified prefix, not a complete verified economic run.
Ledger diagnostics retain `NON_ADMITTED`, `learned:false`, `modelArtifact:null` and `trainingReady:false`.
Full418 features, posterior/promotion kernels, learner software, calibration and training remain deferred.

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

Deferred: full economic belief/features, learner software, training readiness, real training, profiling, learned artifacts and final legacy cleanup.
