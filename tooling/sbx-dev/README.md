# Composed development sandbox preparation

These commands use the existing development `sbx` service. They do not provision a dedicated F9 host service, change credentials/policy, prove provenance/quotas, run Cargo/KUnit/ML workloads, or establish F9/Native/training readiness. Mise pins Bun **1.4.0** and Rust **1.95.0** in the root `mise.toml`. The host may download those versions; the guest keeps its existing network denial and needs no Bun.

## One parent, separate child tasks

`dev:sbx:prepare` actually invokes and awaits each child through `mise run --raw`, in this order. It does not use parallel `depends` tasks.

| Task | What it does |
|---|---|
| `dev:sbx:acquire` | Approve host acquisition through mise; construct the guest archive and SHA-256 automatically. |
| `dev:sbx:validate` | Approve local archive validation and create private state. |
| `dev:sbx:create-stage` | Approve one mountless create through the existing `create.sh`; capture its generated name. |
| `dev:sbx:policy` | Approve policy readback for that name; retain a bounded private file. |
| `dev:sbx:accept-policy` | Inspect and acknowledge that exact policy file/name/digest before any copies. |
| `dev:sbx:provision` | Approve two attempt-unique copies: archive and fixed installer. No guest execution. |
| `dev:sbx:install` | Approve bounded offline Rust/Cargo 1.95.0 installation inside that box. No downloads. |
| `dev:sbx:diagnose` | Approve bounded capability/policy diagnosis and retain the F9 STOP report. |

The parent propagates the confirmed generated sandbox name through private state. **Do not supply `CREATED_NAME` or manually copy a name between these tasks.** Each child presents its own scope and requires a fresh `approve` response through a terminal. There is no production `--yes`, piped approval, or approval inherited from the parent. Starting the parent does not approve later live stages.

Deadlines bound command work. Each bounded subprocess may use up to two more seconds for reaping. Validator and diagnostic supervisors may first allow one second for cooperative cancellation.

## Commands: no archive, digest or box name to supply

Use an existing installed `sbx` on `PATH`. The automatic packaging path supports **Linux x86_64 GNU hosts**; unsupported platforms refuse rather than shipping incompatible binaries.

Review the checked-in `mise.toml`, then trust that configuration explicitly and install its exact host versions. These are explicit host operations, not VM operations or automatic preview dependencies:

```fish
mise trust
mise install
mise run dev:sbx:prepare -- --plan
```

The preview reads the checked-in pins and prints the ordered task graph. It does not resolve executables, inspect toolchains, allocate state, prompt, run children, download, install or contact `sbx`. Its execution-effects fields describe what a later approved run may do; `previewEffects` stays all false. The outer mise process still loads its own configuration, and `auto_install = false` remains set.

Then start the interactive parent. It discovers `sbx`, acquires the pinned host Rust toolchain after approval, and calculates the archive and checksum internally:

```fish
mise run dev:sbx:prepare
```

Do not pipe `approve` into this command or redirect its prompt output. Both stdin and stderr must remain terminals. All eight child tasks pause independently; policy acceptance requires inspecting the private file before responding. That acknowledgement authorizes only the selected development attempt; it is **not** proof of deny precedence or reusable F9 authority. `--sbx` remains an optional absolute executable override if `sbx` is not on `PATH`.

### Automatic host acquisition

The acquisition child invokes the exact built-in mise Rust backend, never `latest`/`stable`: `mise install --jobs 1 core:rust@1.95.0`, then bounded `mise exec core:rust@1.95.0` version/host, sysroot and Cargo-version queries. It obtains the **actual Rust sysroot**, not a cargo/rustup proxy directory. It packages the compiler/Cargo executables and required sysroot library tree into the private run directory; it never copies a broad home, Cargo registry, rustup cache or repository. Internal links may be materialized only inside that selected sysroot; escaping/cyclic links and special files refuse. Dependency-owned files remain allowed under the repository language policy.

The helper creates regular-file tar contents, computes SHA-256, verifies the archive with the existing validator and publishes a private acquisition manifest. Both values flow automatically into validation and provisioning. Caps remain 2 GiB archive, 4 GiB expanded and 20,000 members. The manifest records configured pins, checked Rust/Cargo version/target and transfer integrity; it is **not** independent upstream authentication or F9 provenance. Mise's user configuration, mirrors and already installed trees remain outside that claim. No mise lockfile or signature evidence is fabricated.

For advanced callers, supplying both `--bundle ABSOLUTE_ARCHIVE` and `--sha256 LOWERCASE_DIGEST` selects the previous offline-input path and skips acquisition. Supplying only one refuses. Normal usage needs neither.

## Operations, state and failures

- The parent creates a fresh owner-only run directory under `/tmp/opencode` when available, otherwise the platform temporary directory. It prints `STATE_PATH=…` before child execution. This small bookkeeping directory can remain even if the first approval is declined. State, policy and report files use `0600`; state files contain no credentials or raw policy.
- Host acquisition retains its own intent marker, manifest and generated archive in that run directory; failure stops before validation/creation and leaves partial artifacts for reconciliation. Shared mise/rustup installation/cache storage is not a hard-quota F9 envelope.
- Creation keeps the existing `ls/create/ls` scope: mountless `shell`, `--pull never --skills off --deny-network '**' --cpus 2 --memory 4g`. A generated name is not confirmation; later tasks require the exact successful creation marker. No sandbox is removed automatically.
- Policy readback has a 10-second/64-KiB bound. The operator reviews its retained private file. Requested deny rules alone do not prove effective egress denial against kit/global allows.
- Provisioning consumes its policy acknowledgement, then creates exclusive snapshots of the bundle and fixed installer in the private run directory. A separate Bun helper enforces a 60-second/16-KiB bound. It opens only regular, non-symlink inputs, checks approved SHA-256 values and stable source metadata, and retains completed snapshots as `0400` files. The archive snapshot passes the existing layout check before **either** copy. Only snapshots transfer to `/home/agent/workspace/devrust-tools-ATTEMPT.tar` and `install-rust-ATTEMPT.sh`; replacing an original source afterward cannot redirect the transfer. Copy deadlines remain 90 and 45 seconds, with 16-KiB output caps. Snapshots consume up to 2 GiB + 64 KiB additional disk per attempt and remain after success or failure.
- Installation uses guest `/usr/bin/timeout --kill-after=2s 120s` and a 130-second host bound. A fixed shell wrapper opens the guest installer once, checks its approved digest through `/proc/self/fd/3`, and executes that same descriptor. The installer rechecks the archive digest, extracts to `/home/agent/workspace/devrust-tools`, refuses an existing or symlink target, and checks Rust/Cargo 1.95.0 plus the GNU x86_64 host target. These invocations check basic executable startup, not full build/runtime ABI closure; failure never enables a network fallback or copies arbitrary host system libraries. Linux guest `/proc/self/fd` support is required. Private snapshots and descriptor binding do not protect against a compromised same-UID process or concurrent in-place guest file writes. The guest archive and installer remain after installation.
- Diagnosis invokes the underlying Bun diagnostic directly inside the `dev:sbx:diagnose` mise child. Its 60-second outer deadline sends TERM first so the cooperative helper can stop its detached CLI, followed by KILL after at most one second and at most two seconds of reaping. Unexpected helper death does not prove descendant or guest termination. The wrapper captures the original helper's exit 2 and accepts **stage completion only** with the exact matching complete `f9-live-diagnostic-v1` STOP report. It does not assume mise preserves a nested task's numeric exit. All 44 F9 requirements remain blocked where their verifier is absent.
- New/touched Bun launchers use `--no-env-file --no-install`. This prevents Bun's automatic dotenv loading and package acquisition; it does not erase already inherited environment variables or override mise/user service configuration.
- Each stage records in-flight intent before its provider operations. A timeout, interruption, partial copy, malformed result or uncertain state update retains state for reconciliation. `RECONCILE` or an in-flight stage blocks later stages. There is no automatic retry, resume, reset, rollback or removal. An unattempted next stage remains separately callable with fresh approval; a completed stage cannot run again.
- Killing a host CLI does not prove guest termination. `exec` can start a stopped box. The helper never resets the shared daemon or touches other named sandboxes. Any follow-up inspection, new attempt or cleanup needs its own approval.

Successful child stages return 0 for their narrow setup result. The parent eventually reports `developmentPrepared: true`, `diagnosticComplete: true`, **`result: "STOP"`, `f9Qualified: false`, `trainingReady: false`**, and exits 2. Mise may display task failure even though preparation completed. No whole-F9 time/resource envelope is claimed; human approval pauses have no automatic deadline.

After successful preparation, the parent prints its unchanged JSON receipt to stdout, then explains `DEVELOPMENT_SETUP_COMPLETE` and `F9_NOT_ASSESSED` on stderr. This completion text never appears for plan mode or a failed stage. Exit `2` remains intentional F9 refusal, not a development setup failure.

Use the receipt's `reportPath` with the offline explanation task instead of rerunning setup:

```fish
mise run f9:explain -- --report /absolute/path/to/report.json
```

The explanation distinguishes recorded PATH resolution from the fixed seeded Rust executable checks. It labels the 44 unrun acceptance requirements as unassessed, not failed tests. It does not change the saved report or contact the VM. Successful explanation exits `0` for presentation only; rejected reports and argument/read errors still exit `2`. F9 remains STOP, qualification/readiness flags remain false, and the diagnostic/preparation commands still exit `2`; see the [diagnostic guide](../native-ingress/F9-DIAGNOSTIC.md#explain-an-existing-report-offline).

For individual stages, use the printed state file: every child after validation accepts only `--state` with that exact absolute path. Acquisition takes `--manifest` inside a new private run directory; its receipt supplies the archive/hash to validation. Validation additionally needs `--sbx`, `--bundle`, and `--sha256`, and a new private state file; the parent passes them for you. The older `dev:sbx:create` remains a standalone one-attempt helper; it does not create workflow state. The old combined `dev:sbx:seed` refuses before provider calls; use separate provisioning and installation.

## Offline verification

```fish
bun --no-env-file --no-install test tooling/sbx-dev/tests
```

Tests use fake mise/sbx executables, test-only approval injection and pseudo-terminals. They do not contact an installed sandbox service or execute a real Rust toolchain. Fake-mise tests do not certify installed mise behavior.
