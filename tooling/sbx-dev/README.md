# Development sandbox preparation

These commands use the existing development `sbx` service. They do not provision a dedicated F9 host service, change credentials/policy, prove provenance/quotas, run Cargo/KUnit/ML workloads, or establish F9/Native/training readiness. Mise pins Bun **1.4.0** and Rust **1.95.0** in the root `mise.toml`. Each acquisition and live operation requires its own approval.

## Complete tools in an existing sandbox

**Preflight transport v2 offline verification: 891 tests PASS; actual provisioning remains unqualified.** The complete-tools task remains separate from the legacy Rust-only workflow below. It does not create a sandbox or reuse legacy state, tool roots or completed attempts.

The profile in [complete-profile.mjs](complete-profile.mjs) declares five upstream prebuilt artifacts: Bun **1.4.0**, Rust/Cargo **1.95.0**, Zig **0.17.1**, mise **2026.11.2** and LLVM/Clang **23.1.5**. These declarations are not inspected archive inventories, authenticated publisher keys or demonstrated runtime compatibility. Rust's compressed size remains unknown. The workflow never selects a source-building backend or enables guest networking.

The host needs an already approved working mise, Bun and `sbx`. Review and explicitly trust the changed mise configuration before using it. No task dependency installs tools automatically. Preview the actual selected instance without executable discovery, source-file checks, writes, downloads or sandbox queries inside the helper:

```sh
mise run dev:sbx:prepare-tools --name devrust-19b6330ee5f5e08ad90fcb30 --plan
```

Mise itself still loads its configuration before this lexical preview. A successful `PLAN_ONLY` result proves neither availability nor permission.

After separate operational authorization, remove `--plan` to start the raw-terminal approval sequence. Keep stdin and stderr attached to a terminal. Every stage requires a new literal `approve` response. There is no `--yes`, piped approval or inherited consent. An optional `--sbx` accepts a canonical absolute executable path instead of PATH discovery.

| Order | Stage | Separately approved effects |
|---|---|---|
| 1 | `policy` | Read bounded policy for the selected existing name into a private host file. |
| 2 | `preflight` | Check Linux/x86_64, reported glibc ≥2.18, the nine base tools, writable workspace, GNU tar, XZ and reported guest free space ≥24 GiB. |
| 3 | `accept-policy` | Acknowledge the exact retained policy and preflight after reviewing the private policy file. No provider call. |
| 4 | `reserve` | Exclusively create the fixed guest reservation and fresh private tool/input directories. |
| 5 | `host-capacity` | Check reported host free space ≥10 GiB. |
| 6 | `acquire` | Download the five exact host artifacts, check expected sizes/digests and inspect the Bun ZIP to retain a bootstrap binary without executing it. |
| 7 | `copy` | Create and transfer nine read-only snapshots: five archives, bootstrap Bun and the three guest modules. No guest execution. |
| 8 | `inspect` | Hash-check bootstrap/source inputs and inspect every guest archive before materialization. |
| 9 | `install` | Reinspect all archives, extract offline and assemble the five Rust manifest components as data. Never run vendor `install.sh`. |
| 10 | `verify` | Check six pinned executable versions, retained resource directories and all fifteen PATH names. No compilation or learner workload. |

The nine base prerequisites are `tar`, `sha256sum`, `timeout`, `gpgv`, `patch`, `make`, `ld.bfd`, `readelf` and `node`. Preflight also uses fixed `/usr/bin/timeout`, `/usr/bin/tar`, `/usr/bin/xz`, `uname`, `getconf` and `df`, plus ordinary shell/file utilities. Version startup and the reported glibc floor do not establish full CPU, loader, DSO or native dependency compatibility. Policy acknowledgement does not prove effective deny precedence.

### Bounds and retained state

- New development-only software caps: **2 GiB/archive**, **4 GiB total compressed**, **16 GiB expanded**, **200,000 members** and **256 MiB encoded metadata**. Both host and guest Bun ZIP inspection additionally cap total expansion and each entry at **128 MiB**. Legacy limits stay unchanged.
- Expanded accounting includes retained extracted distributions, extra Rust sysroot copies, bootstrap/source bytes and a 2 MiB control reserve. Host originals and the nine snapshots remain retained. Capacity checks report free space, not reserved quotas, physical-fit proofs, RSS bounds or accepted F9 limits.
- One shared metadata budget debits the archive parsers' consumption, including headers/extensions/extras, rather than JSON inventory lengths. Member accounting includes unique implicit parent directories, fresh package roots and Bun's relocated binary directory before any extraction.
- Strict archive validation rejects unsafe names/links, special or privileged members, unsupported formats and unrecognized metadata. ZIP supports store/deflate with CRC32 and validated-but-ignored timestamp/UID/GID extras. Every artifact must contain a notice and the asserted runtime layout. Actual upstream contents remain uninspected; a missing Bun notice or unsupported layout stops the attempt without relaxing the guard or selecting a fallback.
- New host state lives in `/tmp/opencode/dev-sbx-tools-*/attempt.json`. The task prints its actual `STATE_PATH`. It appends exclusive `NN-stage.intent.json` and `NN-stage.complete.json` files. Failure after intent becomes terminal `RECONCILE`; it never retries, overwrites, resets, removes, rearms or cleans up automatically.
- The guest root is `/home/agent/workspace/devtools-<16lowerhex>`. The fixed directory `/home/agent/workspace/.complete-dev-tools-v1` reserves the profile across host attempts. Neither success nor failure removes it. An existing marker stops another reservation; creating a new host attempt does not authorize bypassing it.
- A declined, unattempted next stage can later use `dev:sbx:prepare-tools --state` with the exact printed state path and `--stage` with that next stage. It still requires fresh terminal approval. Completed or in-flight stages cannot run again.
- Acquisition allows at most three manual HTTPS redirects to its allowlisted upstream/asset hosts, with 120-second request/body deadlines and a 600-second acquisition deadline. Each copy uses 180 seconds/64 KiB. Each inspection/installation/verification invocation uses guest timeout 1200 seconds + 2-second kill escalation and host 1210 seconds/64 KiB, with 1-second cancellation grace and bounded reaping. Guest XZ/tar operations use 1200 seconds/16 KiB; each version/presence query uses 10 seconds/16 KiB. These are software operation settings, not original F9 clocks or quiescence proofs.
- The helper preserves private snapshots and checks stable descriptors. Those checks do not protect against a compromised same-UID process or qualify G1 continuing backing. A killed host controller does not prove guest termination. `sbx exec` can start a stopped VM.

### Scoped PATH and result

Successful development verification returns `DEV_TOOLS_READY`, `developmentToolsPrepared:true` and exit `0`. It keeps **`gate0:"OPEN"`, `f9Qualified:false`, `trainingReady:false`, `explanation:"NOT_RUN"`**. Notice retention does not qualify licensing or publisher trust.

`guestToolContext()` scopes PATH, HOME, mise directories, disabled automatic mise installation and Zig caches to one command. It does not edit `.profile`, mutate the global guest PATH, trust mise configuration or confine every startup/configuration effect. The task preserves the full original distributions; it does not copy arbitrary host libraries or manufacture tool wrappers.

This workflow does **not** stage a checkout, the explainer's import closure or a saved diagnostic report. Those remain separately approved prerequisites for [`f9:verify-sbx --tool-root`](../native-ingress/F9-DIAGNOSTIC.md#optional-complete-tool-context). It does not implement `f9:gate0`, accept any Gate0 record or grant training permission.

### Failure diagnostics for future attempts

**Historical reporting-only verification: 79 targeted tests and 787 full tooling tests, with zero failures.** That reporting code passed static quality/security reviews. The earlier 731-test result belongs to the preceding provisioning commit. That verification used synthetic fixtures and fake providers under separate approval; it accessed no existing attempt files and ran no live guest commands. These results do not verify the newer transport contract below.

On failure, the CLI keeps stdout empty and exits `2`. Stderr retains the original `DEV_TOOLS_STOP; ...` line verbatim, then adds one JSON diagnostic line of at most 4096 UTF-8 bytes. Existing operator prompts and the `STATE_PATH` announcement remain separate from that diagnostic. The original reporting change added no failure file or state-schema change; transport v2 separately adds the private diagnostic files described below.

An illustrative future result—not a diagnosis of the reported failed attempt—is:

```json
{"schema":"dev-sbx-complete-failure-v1","result":"DEV_TOOLS_STOP","stage":"preflight","phase":"EFFECT","failures":[{"check":"XZ","code":"REQUIREMENT_UNMET","expected":"EXECUTABLE"}],"gate0":"OPEN","f9Qualified":false,"trainingReady":false}
```

- The diagnostic includes only fixed stage, phase, check, code and expectation labels. It omits observed values, raw provider stdout/stderr, policy, argv, paths, identifiers, hashes, URLs, exception messages/stacks and control characters. Unregistered exceptions become `INTERNAL_ERROR`; arbitrary exception properties cannot supply diagnostics.
- Preflight validates its entire protocol before reporting known unmet requirements in fixed order. Missing/duplicate/reordered/unknown fields, invalid values and truncation produce `PROTOCOL_INVALID`, not assertions based on partial observations. Prerequisite requirements remain unchanged; transport v2 adds the marker/routing contract below.
- Command failures distinguish `TIMEOUT`, `OUTPUT_LIMIT`, `INTERRUPTED`, `SPAWN_ERROR`, `STREAM_ERROR`, `INCOMPLETE_STREAM`, `NONZERO_EXIT`, `SIGNAL`, `UNEXPECTED_STDERR` and `EXECUTOR_RESULT_INVALID`. Failed execution never feeds partial output into prerequisite evaluation. Preflight v2 uses the channel contract below; other quiet-stage guards still reject nonempty stderr.
- `phase` names the host boundary: argument handling, initialization, state read, before/after approval, intent write, effect or finalization. It does not prove that a guest command started/stopped or that a reservation exists. `INTENT_WRITE_UNCERTAIN` does not establish safely unattempted work.
- The generic reservation warning remains generic, including when failure occurs before `reserve`. Preserve the actual attempt files. Reporting grants no retry, migration, rearming, removal or automatic new attempt. Source-binding checks must refuse old attempts after code changes.

The supplied `/tmp/opencode/dev-sbx-tools-X5NYWI/attempt.json` log shows policy completion followed by approval of preflight and a generic STOP. It does not identify the cause or establish whether the guest command started. These source changes do not inspect, modify or recover that attempt.

### Private raw preflight traces

Transport v2 passed 212 targeted and 891 full tooling tests through mise with Bun 1.4.0, with zero failures. The language-policy scan passed for 2,136 first-party files. The actual mise trace preview returned the v2 plan; the normal preview retained its v1 schema and unchanged profile. Tests include fake providers and real local timeout/shell execution of synthetic commands, not live sbx. Quality/security code reviews returned READY without findings. Both diagrams passed syntax checks and rendered, including the embedded approval-prompt wireframes; named-guest v2 execution remains NOT_RUN. The earlier trace v1's 156/835 results remain historical.

[Docker's automation contract](https://docs.docker.com/ai/sandboxes/workflows/automation/#parse-command-output) places progress, hints, warnings and errors on stderr. The user-supplied v1 trace retained a 59-byte sandbox-start notice and independently reported insufficient space for the 24 GiB floor. A local decode of the supplied base64 matched the report's byte count and SHA-256. This establishes retained-byte consistency, not authenticated origin or the cause of the earlier failed attempt. Keep that v1 capture unchanged; do not reinterpret it as a v2 report.

`--trace-preflight` adds an independent diagnostic route to the existing task. It does not resume a preparation attempt. It requires explicit `--sbx` and `--name`; combining it with `--state`, `--stage`, arbitrary commands or output destinations refuses.

Preview the exact one-call operation without controller discovery, source checks, trace allocation or provider access:

```sh
mise run dev:sbx:prepare-tools --trace-preflight --sbx /usr/bin/sbx --name devrust-19b6330ee5f5e08ad90fcb30 --plan
```

On the sbx-enabled host, removing `--plan` requests a fresh raw-terminal approval. The prompt binds the controller, target, source hashes, fixed operation, transport contract, private output directory and bounds. No prior diagnostic/preparation consent carries over. The trace invokes one `sbx exec`, with guest timeout 15s/+1s kill escalation, host deadline 25s, a 16 KiB combined retained-output cap and existing bounded host reaping. It reads no preparation state or policy and installs nothing. The fixed metadata script requests no guest file writes. Exec may start a stopped VM; host termination does not prove guest termination.

The helper allocates a fresh `0700` `/tmp/opencode/dev-sbx-trace-*` directory. After consent, it creates/fsyncs exclusive `0600` `intent.json`, `stdout.bin` and `stderr.bin` before invocation. It retains the bounded original bytes without UTF-8 conversion, then exclusively writes `0600` `report.json`. Failure, interruption, timeout or overflow never triggers cleanup, overwrite, replay or automatic retry. A failed persistence operation can leave incomplete artifacts without a report; preserve them.

Only sanitized metadata reaches the terminal: generated paths, retained-byte SHA-256 digests, outcome/code/signal, observed pipe-byte counts, retained counts, truncation and separate stdout-protocol observations. Digests describe retained bytes, not complete output or authenticated provenance. Keep raw files outside Git and use a control-character-escaping viewer for local review. Full technical messages, paths, versions and stack traces can help diagnosis; mask actual secrets before sharing. Neither the helper nor normal verification prints raw captured bytes.

Trace plan, intent and report schemas now use `v2` and declare `dev-sbx-preflight-transport-v1`. Normal preflight and tracing share one fixed operation. Its outer guest shell redirects stderr into stdout before emitting `DEV_SBX_PREFLIGHT_TRANSPORT_V1` and starting the existing timeout/metadata script. The host requires that exact marker at byte zero, fatal UTF-8 decoding and the entire ordered metadata protocol. Extra guest diagnostic output invalidates the protocol even when the guest exits zero. Missing/legacy markers, truncation, inconsistent successful byte counts, nonzero exits, signals and bounded-runner failures still stop acceptance. The 24 GiB floor remains unchanged.

Outer stderr remains byte-exact diagnostic data and does not fail preflight merely because it is nonempty. This is a routing contract, not a message allowlist or `2>/dev/null`. `origin:"UNATTRIBUTED"` remains: outer-shell startup and pre-exec diagnostics can reach this pipe, so it is not an authenticated controller-only channel. Outer mise/Bun startup output bypasses the child-process capture. Remaining quiet stages still require empty stderr; this preflight-only correction does not qualify their cold-start behavior.

Normal preparation retains the same bounded pipes in exclusive `0600` siblings `02-preflight.stdout.bin` and `02-preflight.stderr.bin`, followed by `02-preflight.transport.json`. It allocates the raw files after stage intent but before invocation, then persists safe captured buffers before execution-metadata, protocol, capacity or post-execution source-binding rejection. A valid failed outcome or unmet prerequisite still gets a private transport report. Unsafe buffers or persistence failure can leave incomplete artifacts without a report. These files are diagnostics only; they cannot complete, resume or authorize a stage. Workflow/event/receipt schemas and preflight completion-data keys remain unchanged.

Exit `0` with `traceComplete:true` means the private capture/report was persisted, even if the captured command failed. The summary always keeps `result:"STOP"`, `gate0:"OPEN"`, `f9Qualified:false` and `trainingReady:false`. This is not successful provisioning, a retry grant, a cleared reservation or an accepted F9 record.

Current-realm metadata establishes only local tool resolution. It does not bind the named guest or establish cold-run equivalence, pinned versions, ABI closure, quotas or readiness. The agent realm exposes mise/Bun but no `/usr/bin/sbx`; local mise task previews and fake-provider tests do not execute the host provisioning path. No package installation or mise self-update follows from a missing tool or update warning.

A separate direct current-realm-only preflight captured private files in `/tmp/opencode/current-realm-preflight-Xeb86L`, without an sbx controller. It exited `0` with 436 stdout bytes and 0 stderr bytes; its validated protocol reported missing `patch`, `ld.bfd`, `readelf` on the checked PATH and insufficient reported free space for the 24 GiB floor. The directory is `0700` and its four files are `0600`. This local observation did not reproduce or diagnose the named host's `UNEXPECTED_STDERR`; the failed preparation attempt remains unchanged.

## Legacy Rust-only preparation

The following workflow creates a new sandbox and seeds Rust/Cargo only. Its guest needs no Bun. Its state, limits and operational contracts remain unchanged.

### One parent, separate child tasks

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
