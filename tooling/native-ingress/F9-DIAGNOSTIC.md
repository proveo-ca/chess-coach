# Live sandbox reconnaissance and full F9 blocker report

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

This task performs **no F9 capture/build/KUnit/G1/5c/Native workload**, so it does not bypass their Gate0/first-effect/host-isolation approvals. R4 and R5 remain separate training-readiness gates. Reviewers remain deferred under the current instruction.

## Offline verification

```fish
bun test tooling/native-ingress/tests/f9-diagnose.test.mjs
bun run check:no-python
```

The fake-CLI tests exercise the ordered protocol, failures, caps, timeouts, interruptions, privacy and complete blocker coverage. They do not invoke the installed `sbx`, `mise`, a live VM, or the learner.
