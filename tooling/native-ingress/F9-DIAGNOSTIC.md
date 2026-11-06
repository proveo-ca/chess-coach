# F9 offline design checks and sandbox reconnaissance

## Check proposed Gate0 records offline

`f9:gate0` checks the proposed structural contract in [the checker plan](../../_spec/_plans/native-ingress-gate0-checker.md). It does not launch a sandbox, invoke another program, inspect installed inputs, follow references, modify the canonical ledger or obtain acceptance. These guarantees cover the helper, not outer mise/Bun startup or runtime-cache effects.

Start with the read-free plan:

```sh
MISE_AUTO_INSTALL=false mise run f9:gate0 --plan
```

Check two explicit input snapshots after preparing a proposed profile:

```sh
MISE_AUTO_INSTALL=false mise run f9:gate0 --profile /absolute/path/to/proposed-profile.json --ledger /absolute/path/to/native-ingress-rust-first-full-plan-packet.md
```

The proposed profile describes the file/API plan, independent input declarations, selected build units and producers, trust/origin records, invoice, declared resource peaks and section-8 consistency bindings. The checker validates closed schemas, references, build-unit/producer cycles, planned-output ownership, stage-specific identity declarations, checked inclusive invoice arithmetic and exact original-byte binding ranges. References remain data; no referenced file or URL is opened. Each explicit input is at most 1 MiB, with a 2 MiB combined software cap and bounded parsing. These are development limits, not accepted F9 physical bounds or protected-backing proof.

- `mechanical:"READY_FOR_REVIEW"` with exit `0` means the listed mechanical checks passed, not that the descriptions are true, exhaustive or accepted.
- Missing records, invalid bindings or inconsistent graphs produce `mechanical:"BLOCKED"`, fixed-code findings, required record IDs or row indices, and canned next-artifact instructions; exit `2`. No arguments report `PROFILE_REQUIRED` without reading files.
- The supplied ledger remains `ledgerTrust:"UNAUTHENTICATED_SNAPSHOT"`. A matching marker, excerpt or digest does not authenticate an independent human decision. Canonical §8 remains the sole acceptance ledger.
- `--finalize` always returns exit `2` with `ACCEPTANCE_PROTOCOL_UNAPPROVED`. A trusted finalizer cannot be implemented or enabled from a caller's `accepted:true`, matching hashes or an approval-looking string.
- Every report keeps `gate0:"OPEN"`, `f9Qualified:false` and `trainingReady:false`, with outstanding human-review obligations. The real unit inventory and current acceptance records are not fabricated from test fixtures or historical research.

`profileSha256` hashes canonical, recursively key-sorted profile JSON with `decisionBindings` excluded. `profileBytesSha256` hashes the exact profile bytes; `ledgerSha256` hashes the exact ledger bytes. Binding excerpts retain their original line endings. The proposed section-8 markers do not exist by inference and are never auto-inserted. Synthetic positive profiles exercise checker behavior only.

Current offline verification passed through mise with automatic installation disabled: **587 checker tests**, **147 terminal-harness tests**, and **1,498 full tooling tests across 17 files**, all with zero failures. The stages suite also passed **105 tests under a real local PTY**. The language-policy scan passed over **2,140 first-party files**. Each command used a 120-second deadline with a 2-second kill allowance. These are development-software checks, not Gate0 acceptance or live F9/R4 proof. The earlier transport-only 212/891 results remain historical. The supplied host's 888-pass/3-fail run exposed an ambient-TTY assumption and an unavailable hardcoded PTY utility; this local verification does not establish the host's current PTY capability.

## Live development reconnaissance

`f9:diagnose` is a Bun convenience task. It connects to one explicitly named sandbox and reports the F9 requirement ledger. It is **not** a qualified F9 launcher or an implementation of the missing authority verifiers. It always prints `result: "STOP"`, keeps `trainingReady: false`, and exits 2, even when `diagnosticComplete: true`.

For automatic name propagation plus offline provisioning/installation, use the composed [`dev:sbx:prepare` workflow](../sbx-dev/README.md). Its child tasks require separate terminal approvals and retain the diagnostic STOP report. The standalone `f9:diagnose` task remains available; its Bun launcher now disables automatic dotenv loading and package installation. Existing exported environment and mise configuration remain in effect.

## Fresh-box workflow: two separately approved invocations

1. Request fresh approval for one `dev:sbx:create` attempt. That existing task requests a mountless `shell` box with `--pull never --skills off --deny-network '**' --cpus 2 --memory 4g`, without transferring the checkout or inputs. It uses the existing development service and does not prove F9 identity/routing/policy/quotas. From Fish, **only after creation approval**:

   ```fish
   mise run dev:sbx:create -- --sbx (realpath -- (which sbx))
   ```

2. Inspect the result. Only a confirmed `DEV_CREATED_NAME=…` supplies the name for the next request. An ambiguous creation needs reconciliation, not an automatic retry. Request a **new exact diagnostic approval** naming the executable, newly created name, existing development identity/configuration, three operations below, deadlines and output handling. From Fish, **only after that approval**:

   ```fish
   mise run f9:diagnose -- --sbx (realpath -- (which sbx)) --name REPLACE_WITH_DEV_CREATED_NAME --confirm-dev-diagnostic
   ```

The confirmation flag acknowledges development reconnaissance; it does not grant host or VM permission. Mise may load checkout/user configuration before the helper runs. Do not infer dedicated-service routing from this task.

For a no-`sbx` preview, append `--plan` instead of the confirmation flag. That mode prints the exact frozen argv/deadlines without inspecting the executable or contacting the service; it still exits 2. It grants no permission to run the previewed operations.

## Exact diagnostic operation scope

The helper validates an absolute, regular, executable, non-symlink `--sbx` path and a literal name. It accepts no provider, guest command, credential, routing override or approval-record options.

| Order | Command | Deadline | Combined stdout/stderr cap |
|---|---|---|---|
| 1 | `sbx ls -q` | 10 s | 64 KiB |
| 2 | `sbx policy ls --wide NAME` | 10 s | 64 KiB |
| 3 | `sbx exec NAME /usr/bin/timeout --kill-after=1s 8s /bin/sh -c FIXED_SCRIPT` | 20 s | 16 KiB |

The literal `FIXED_SCRIPT` is exported as `guestScript` in [f9-diagnose.mjs](f9-diagnose.mjs). Review those exact bytes before execution approval. The guest's fixed `/usr/bin/timeout` wraps the script with an 8 s deadline and 1 s kill escalation; if unavailable, the probe fails without a fallback. The script reads guest UID and shell FD soft limit, tests workspace writability without writing, checks resolution of fixed tool names, and checks whether the separately seeded Rust executable paths exist. It does not execute Cargo, Rust, Node, KUnit or a model; run a build/test; access host `/proc`; scan a home/cache; print the environment; install tools; or perform a network probe. Missing tools are `MISSING`/`UNAVAILABLE`, not proof of an incomplete captured F9 closure. Tool presence is not version, compatibility, provenance or effective-enforcement evidence.

Policy readback is included in this **separate diagnostic approval**, not inherited from create. A policy listing can contain private domains/configuration: the helper keeps it only in bounded memory, prints its digest rather than raw contents, and does not claim to verify allow/deny precedence. No files or evidence bundles are written locally. Guest output must match the complete fixed field schema; unexpected, duplicate or malformed fields refuse. The report never prints raw CLI stderr.

Failure, overflow, malformed output, timeout or interruption stops subsequent commands without retry or fallback. Deadlines terminate only the helper's owned CLI process group, with at most 2 s bounded reaping per operation. Total CLI scope is at most 46 s plus argument validation/reporting. A killed CLI does **not** prove its guest command stopped. An `exec` can start a stopped VM. The helper never creates, copies into, stops, removes, resets, prunes, authenticates or reconfigures a sandbox/service. The box remains; any later inspection, retry or cleanup needs its own exact approval.

The composed preparation wrapper gives this helper a 60 s outer deadline. Cancellation sends TERM first so the helper can terminate its detached CLI, then escalates to KILL after at most 1 s and allows at most 2 s for reaping. This cooperative cleanup does not guarantee descendant cleanup after an unexpected helper crash or prove guest termination.

## Reading the report

- `probes`: `PASS`, `FAIL` or `NOT_RUN` for local argument checks and the three executed CLI operations. `cliSucceeded` describes CLI exit, not the semantic check; malformed data still produces `FAIL`.
- `diagnosticComplete`: every requested reconnaissance stage completed with valid output. It does **not** mean all F9 proofs ran or passed.
- `liveGuestObserved`: a matching guest capability protocol returned. A visible name does not prove stable VM identity, source custody, F9 service routing or a booted G1 witness.
- `guest`: bounded capability observations only. Guest UID, FD limits and tool resolution do not prove host aggregate bounds, Docker policy parity, loading confinement or first-effect payment.
- `requirements`: the complete checked-in F9 readiness ledger, with source references and next evidence steps. An independent verifier is not wired for these requirements, so they remain `BLOCKED`; no caller-supplied `ready` flag can promote them.
- `result: "STOP"`, exit 2: F9 remains unqualified. Mise will display task failure; do not mistake completed reconnaissance for readiness acceptance. `f9:status` remains unchanged and offline.

This task performs **no F9 capture/build/KUnit/G1/5c/Native workload**, so it does not bypass their Gate0/first-effect/host-isolation approvals. R4 and R5 remain separate training-readiness gates. Development-code reviews do not replace independent F9 acceptance.

## Explain an existing report offline

`BLOCKED`, `execution: "NOT_RUN"`, and `verifier: null` mean the independent F9 acceptance checks did **not run**. They do not describe failed test executions. Four successful reconnaissance probes can coexist with all 44 F9 requirements remaining unassessed.

Read one complete saved report without contacting the sandbox or rerunning preparation:

```fish
mise run f9:explain -- --report /absolute/path/to/report.json
```

If mise rejects the updated configuration as untrusted, review `mise.toml` and run `mise trust` explicitly before invoking the task.

The task prints a human explanation instead of changing the report's JSON. It reads only the selected regular file, refuses a symlink leaf or a file larger than 128 KiB, and checks stable descriptor metadata. It creates no state, follows no report references, spawns no child processes, and performs no live checks. A saved report is neither fresh evidence nor independently authenticated. Plan-only, incomplete, inconsistent, and unsupported reports refuse without a success summary. Successful formatting exits `0`, including for a valid STOP report. Rejected reports and argument/read errors exit `2` with fixed stderr and no explanation output. Formatting success grants no F9 qualification or training permission: `f9Qualified=false` and `trainingReady=false` remain unchanged. The operational `f9:diagnose` and `dev:sbx:prepare` commands still exit `2`. Mise/user configuration still applies before the helper starts, and `auto_install=false` remains unchanged.

PATH observations and seeded tool observations answer different questions:

| Report observation | Meaning |
|---|---|
| `TOOL_rustc=MISSING` / `TOOL_cargo=MISSING` | `command -v` did not resolve those names in the diagnostic shell. This does not prove the tools are uninstalled. |
| `SEEDED_RUST=EXECUTABLES_PRESENT` | Both fixed files under `/home/agent/workspace/devrust-tools/bin/` passed executable-presence checks. The diagnostic did not run them or verify their versions, compatibility, or provenance. |
| `SEEDED_RUST=UNAVAILABLE` | The combined check did not establish both seeded executables. Individual availability remains unknown. |

Only the composed preparation receipt establishes `developmentPrepared: true`. The standalone saved diagnostic establishes no preparation completion, F9 qualification, or training permission.

## Verify guest tools and run the explainer from an sbx-enabled host

`f9:verify-sbx` checks an explicitly selected guest, then runs the existing explanation task **inside that guest**. It does not create or provision the guest. The legacy preparation workflow seeds Rust only. The separate [complete-tools workflow](../sbx-dev/README.md#complete-tools-in-an-existing-sandbox) implements offline provisioning for the full profile; synthetic tests pass, while actual provisioning remains NOT_RUN.

The guest must already contain an approved checkout/configuration, the explainer's source imports, and a complete saved diagnostic report. The runner reads no host report and copies no files. Its required guest PATH names are:

```text
tar sha256sum timeout gpgv patch make clang ld.bfd readelf
node rustc cargo zig mise bun
```

Every name must resolve through `command -v`. Seeded Rust paths do not compensate for missing PATH entries. Resolution proves neither executable versions, functionality, compatibility nor provenance.

Preview the exact operation without inspecting the controller or contacting a guest:

```sh
mise run f9:verify-sbx \
  --sbx /absolute/path/to/sbx --name SANDBOX_NAME \
  --repo /home/agent/workspace/checkout \
  --report /home/agent/workspace/report.json --plan
```

The paths and name above are placeholders, not a discovered instance. Plan success is not execution approval. Mise still loads its own configuration before launching the helper.

After obtaining fresh approval for the exact controller, named instance, guest paths, effective mise configuration/startup effects and operation bounds, replace `--plan` with `--confirm-dev-verification`. The flag acknowledges intent; it does not grant permission. The two modes are mutually exclusive.

The helper validates the explicit host controller as a regular executable non-link leaf, then invokes exactly one operation:

```text
SBX exec NAME /usr/bin/timeout --kill-after=1s 25s
  /bin/sh -c FIXED_SCRIPT sh REPO REPORT
```

The host supervisor requests a 35-second deadline, a 64-KiB combined-output cap and up to one second of cooperative cancellation plus the existing bounded reaping. `sbx exec` may start a stopped VM. These settings and killing the controller do not prove guest termination, effective whole-tree limits or positive quiescence. Leaf metadata checks do not qualify continuing backing or provider identity.

The fixed script reports all fifteen PATH observations. Any missing tool stops before mise runs. Otherwise it changes to the supplied guest repository and invokes:

```sh
MISE_AUTO_INSTALL=false mise run f9:explain --report "$2"
```

`$2` is the quoted positional report argument, not interpolated shell source. The [mise settings reference](https://mise.jdx.dev/configuration/settings.html#auto_install) documents that this environment setting also disables task auto-installation. It does not confine hooks, plugins, explicit task installers, cache writes or every startup effect. Approved source/configuration behavior remains an external precondition. The runner performs no automatic trust, setup, installation or network-policy change.

Task stdout/stderr are discarded inside the guest before the fixed completion result is emitted. The host requires the exact ordered fifteen-tool protocol, its final result and a consistent successful controller exit. Missing tools, failed repository/task execution, malformed/duplicate/extra fields, signals, overflow, unexpected stderr or ambiguous completion return sanitized `STOP` and exit `2`, without raw provider output, retry or fallback.

Only all fifteen recorded tools plus a completed task exit `0` produce development result `PASS` and exit `0`. **Gate0 remains OPEN, `f9Qualified=false` and `trainingReady=false` even on PASS.** A valid explanation can describe all 44 F9 requirements as BLOCKED/NOT_RUN. This runner neither closes Gate0 nor supplies the outstanding independent checker/finalizer or acceptance protocol.

Actual guest verification remains **NOT_RUN** in the authoring environment: `sbx` did not resolve on PATH, and no inventory or guest call ran. Tests with fake providers and fake mise establish no real sandbox result or installed mise compatibility.

### Optional complete-tool context

An explicit `--tool-root` selects `/home/agent/workspace/devtools-<16lowerhex>` from the separate provisioning workflow's actual receipt. Other roots, uppercase identifiers, aliases and trailing slashes refuse. The flag validates only the path shape; it does not authenticate or accept a provisioning receipt.

The profiled script passes that root as positional `$3`. It scopes PATH in this order:

```text
ROOT/rust/bin:ROOT/bun/bin:ROOT/zig:ROOT/llvm/bin:ROOT/mise/bin:/usr/local/bin:/usr/bin:/bin
```

It also scopes HOME, mise data/config/cache and Zig cache directories beneath that root, with `MISE_AUTO_INSTALL=false`. It writes no shell profile or global environment. Provisioning verification prepares those directories; the host verifier does not create them. Disabling automatic installation does not confine hooks, inherited configuration or explicit task effects.

Without the flag, the original script, PATH behavior, report and operation bounds remain unchanged. With it, the same single bounded invocation adds `TOOL_ROOT` after `REPO REPORT`. All fifteen tool checks and the independent approval requirements still apply. The guest must already contain the approved checkout, import closure and actual saved report. Complete tools alone do not supply them, close Gate0 or set `trainingReady:true`.

Profile-context tests passed within the current **731 PASS / 0 FAIL** offline tooling suite. The earlier 118-test receipt covers only its previous scope. Real installed mise and sandbox behavior remain unqualified.

## Offline verification

```fish
bun test tooling/native-ingress/tests/f9-diagnose.test.mjs
bun --no-env-file --no-install test tooling/native-ingress/tests/f9-verify-sbx.test.mjs tooling/native-ingress/tests/f9-explain.test.mjs
bun run check:no-python
```

The fake-CLI tests exercise the ordered protocol, failures, caps, timeouts, interruptions, privacy and complete blocker coverage. They do not invoke the installed `sbx`, `mise`, a live VM, or the learner.
