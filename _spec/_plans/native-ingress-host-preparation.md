# F9 one-time mise host-preparation exception

**HOST INSTALL: COMPLETED SCOPED M2 / APPROVED ONCE / EXECUTED INSTALLED / PRECHECK + ENTRY + INSTALL/POSTCHECK GRANT CONSUMED. NOT F9 CAPTURE/RUNTIME AUTHORITY. M1: APPROVED ONCE / EXECUTED STOP / GRANT CONSUMED.**

Parent reports the separate exact M2 approval and2026-10-21 execution in the [current outcome continuation](#current-outcome--m2-installed--one-time-grant-consumed). Earlier proposal, pending-approval and NOT RUN wording below is historical for its recorded checkpoint and is superseded only for that one M2 host-preparation invocation. M1's strict STOP, registered fence and raw record remain unchanged; no prior grant is renewed.

## Authority ledger — direction is not permission

- Executor first requested `install using mise`, then selected `Host exception (Recommended)` in this exact question:
  > How should mise installation relate to F9’s frozen no-install rule? This decision sets the planning scope; it does not execute mise or download anything. Exact commands, network access and writable destinations still require review.
- The selected option proposes one-time mise Rust 1.95 + rustfmt/clippy host preparation, preserving frozen text and subsequent offline F9 capture/build/runtime. It selects neither the amendment alternative nor the keep-offline alternative.
- [N4](native-ingress-authority.md#n4-captured-runtime-restrictions) states: `It MUST NOT pull, download, install, bootstrap a missing tool, or use an acquisition fallback.` Host preparation proposes an explicit scoped departure from N4; calling it preparation does not make forbidden bootstrap compliant.
- This selection is NOT an actual N4 runtime waiver, acceptance of exact exception bytes, an install permit, or retroactive authorization. N1–N10 and the accepted bf38 text/file remain unchanged; do not edit frozen text or request its reacceptance.
- Lead reports the prior approved bounded lookup completed PARTIAL/exit2 with Node/mise candidates only; its grants remain consumed. Candidate paths prove neither installed version/backend nor usability. No retry, control snapshot, receipt read or fresh probe follows.
- Lead reports read-only Architect and DevOps consultation before this design. This document records a proposal, not operational verification or a completed acquisition packet.

## Tool allowlist and non-goals

- Lead-supplied repository requirements: `rust-toolchain.toml` selects channel `1.95.0`, profile `minimal`, components `rustfmt` and `clippy`; cargo, rustc and host Rust standard library come from that toolchain. No extra targets.
- Scope only the existing mise candidate, its verified supported built-in core Rust backend, Rust 1.95.0 and those components. Any required rustup bootstrap needs its own explicitly named version and integrity identity in the packet.
- Do not replace Node, install all eight lookup names, acquire readelf/Zig/global tsc, upgrade mise or add unrelated tools. Preserve Cargo aliases, scripts and their `--frozen` behavior.

## Staged plan — all operations await their own approval

### 1. Resolve local facts before selecting commands

Draft and review bounded local discovery for mise identity/version/help/backend capability, platform, user-owned destinations and available capacity; obtain separate exact human approval before running it.
Installed mise version/backend support remains unknown. Exclude plugin execution, config/environment dumps, credential handling and home-tree scans; enumerate exact paths, observations, output and time limits instead.
Discovery permission must not include acquisition or install permission. Stop when unsupported or incomplete; do not infer current capability from online documentation.

### 2. Freeze backend, artifacts and side effects

Select exact supported built-in core Rust backend syntax that avoids installed-plugin overrides. Pin `1.95.0`, minimal profile, rustfmt/clippy and host target only; no `latest` or implicit configuration-driven tool set.
If rustup/rustup-init is necessary, separately name its bootstrap version, artifacts and integrity verification; do not hide bootstrap under mise or Rust installation.
Freeze exact endpoints, artifacts, redirect policy, integrity/trust roots and verification, transfer-size/cache/disk bounds, deadlines, output limits and network scope before proposing runnable commands.
Specify a user-owned isolated destination and explicit process environment. Enumerate every install, cache, temporary, state and log write, including bootstrap/toolchain stores, cleanup and peak coexistence; prove destination capacity within the proposed bounds.
Forbid global mise use/settings changes, repository config edits, shell startup edits, persistent PATH changes, sudo, daemon changes and mise self-update. Stop if the installed backend cannot honor the isolation and bounds.

### 3. Review one finite host-preparation packet, then ask

Author one exact supported acquisition+install packet only after stages 1–2 close the unknowns. Review its commands, immutable identities, permissions, writable destinations and failure behavior before presenting it for fresh human approval.
The approval must explicitly name the N4 exception scope, network/trust and write bounds, exact finite packet and one-time authority. The selected planning direction supplies none of those approvals.
No automatic retries, new tools, version substitution, policy training or fallback. Stop on drift, unsupported options, integrity failure, excess bounds or any new prerequisite; draft a separately reviewed proposal instead.
No install command is presented here as runnable. The task is NOT ready for execution until the exact reviewed packet exists and receives fresh approval.

### 4. Keep host evidence separate from F9 authority

If separately approved preparation eventually runs, retain bounded versions, components, resolved paths and artifact/provenance evidence; distinguish observations from successful installation and from runtime proof.
Any Cargo dependency check/build is a separately approved stage retaining `--frozen` and explicit offline restrictions; host-tool installation implies neither cached dependencies nor build permission.
Define a fresh exact F9 capture recipe and independently expected immutable RecipeRef, with an explicit installed-byte allowlist and separate build/runtime contents. Host-preparation evidence is not that recipe identity and does not validate any existing F9 recipe.
Outside a separately approved exception, the no-acquisition F9 law remains intact: subsequent F9 capture/build/runtime stay offline and cannot acquire missing tools or use fallback.
Loading, mixed graph, full policy, actual daemon-used init bytes, invoice, resources and preservation-compatible routing remain OPEN. No source, runtime policy, capture, build, native/model, training, activation or deployment approval follows.

## Documentation basis — not installed-capability evidence

Lead-supplied research consulted current official pages; these do not prove the installed mise version implements their behavior:
- [Rust backend](https://mise.jdx.dev/lang/rust.html): current mise uses rustup and downloads rustup-init if needed; toolchain-file reading requires explicit configuration and global configuration can override it. Explicit supported core-backend selection must avoid plugin overrides.
- [Install CLI](https://mise.jdx.dev/cli/install.html): explicit tool/version install does not add tool configuration; no-argument install can install all configured tools, while mise use edits configuration.
- [Settings](https://mise.jdx.dev/configuration/settings.html): verify relevant isolation/backend settings against the installed version before freezing any command.

## M1 — version-only packet, pending reviews and risk decision

**RECORDED OUTCOME: APPROVED ONCE / EXECUTED STOP / PRECHECK + COMMAND GRANT CONSUMED. Registered command SHA-256: `87204ff190e82a0d13526b25a94008fc1b6ac8405af49ce0c027aed3d209f413`; 2092 UTF-8 bytes /45 LF-terminated lines, as supplied by parent.**

The pending-review heading/anchor and proposal below retain their historical scope. The [recorded execution](#m1-recorded-execution--stop--grant-consumed) supersedes their NOT APPROVED/NOT RUN and pending-decision wording for this one M1 invocation only; no repeat approval question or code change follows. Host installation remains NOT APPROVED / NOT RUN.

This additive packet narrows the next proposed operation to `/usr/local/bin/mise --version` only. It proposes no help, backend list, dry run, platform probe, capacity-content inspection or recipe operation. Stage 1's broader discovery remains deferred, not bundled into M1. No host-install or acquisition exception follows from inspecting a candidate version line.

### Startup-effects finding and prospective Stage 1 clarification

Parent reports independent source retrieval and read-only Architect/DevOps advice for upstream commit `9429be7f20cbd42094902b161d9e3c01b7bc4d3f`:

- [`src/cli/mod.rs`](https://github.com/jdx/mise/blob/9429be7f20cbd42094902b161d9e3c01b7bc4d3f/src/cli/mod.rs): the version path skips install-state, registry and backend loading, but still reaches migration, cache pruning and version hints. Normal help initializes plugin state and can enumerate or delete banned plugins; M1 excludes help.
- [`src/cli/version.rs`](https://github.com/jdx/mise/blob/9429be7f20cbd42094902b161d9e3c01b7bc4d3f/src/cli/version.rs): the single-argument early display is not an early exit.
- [`src/migrate.rs`](https://github.com/jdx/mise/blob/9429be7f20cbd42094902b161d9e3c01b7bc4d3f/src/migrate.rs): migration may inspect metadata, rename or create paths, and write markers.

These are parent-supplied upstream-source findings, not a binding between those sources and installed bytes. **[Unverified] Installed mise version, build identity and startup behavior remain unknown.** No additional native or runtime evidence exists from this planning edit.

Prospectively, Stage 1 exclusions mean that the controller does not request scans, plugin operations, config/environment dumps, credential handling or home-tree scans. They cannot mean that installed startup avoids incidental metadata access, loading, scans, migration, writes or network activity. Unknown installed flag behavior remains possible. The current strict zero-filesystem/network-effects condition is **NOT MET** by M1; this packet must not be presented as satisfying it.

### Distinct human decision required before command approval

Historical pre-approval choices follow; no option was selected or approved when drafted. Parent now reports explicit residual-risk acceptance and one-shot command approval as recorded below, not a standing grant or a renewed question:

1. **Accept trusted-host residual startup-effects risk:** explicitly accept that this one-shot version invocation may cause incidental installed-program effects outside the controller's intended operations, without OS containment or a strict process-tree deadline. Then review and approve the full exact command, its parent-derived digest, limits and residual risk together.
2. **Require containment:** keep M1 unrun while separately designing and reviewing OS-enforced filesystem/network isolation and process-tree containment. No containment mechanism, setup command or permission is supplied here.
3. **Pause:** perform no further operation and retain the unresolved installed facts.

If Executor requires strict zero filesystem/network effects or an absolute process-tree 5-second guarantee, do not run this packet. Documentation and environment flags are not an OS sandbox. Planning selection, inspection of this draft and generic continuation supply neither risk acceptance nor operational permission.

### Controller trust premises and finite limits

- The parent uses its already trusted Node controller, previously used for source checks, through its trusted harness. Stable trusted controller resolution, no inherited `NODE`/`LD` preload mutation and no tracing are trust premises, not newly measured facts. This packet performs no installed-tool or PATH inspection. The child environment below does not inherit local credentials, proxies or `LD`/`NODE` variables.
- The supplied shell wrapper starts the controller and closes controller-startup stderr with `( ... ) 2>&-`. The controller invokes the absolute child path with `execFile`, `shell: false`, and no shell for that child. The controller closes child stdin; it requests no receipt or temporary-file writes.
- Child timeout: 5000 ms, `SIGKILL`, **direct child only**. Required outer trusted-harness tool timeout: 8000 ms. Neither deadline guarantees absolute kernel completion, descendant termination or process-tree reaping. Outer timeout means STOP, not proof of cleanup.
- `maxBuffer: 8192` applies separately to stdout and stderr: at most 16384 retained, reported child bytes. It is not an aggregate transient-memory bound, a hard allocation proof or a CPU bound. See the [Node execFile documentation](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback) and [maxBuffer caveat](https://nodejs.org/api/child_process.html#maxbuffer-and-unicode).
- The normal controller record is capped at 24000 ASCII bytes, including base64 diagnostics. This caps the record, not all transient buffers or installed-process resources. No separate raw child-output stream is requested.
- `/dev/null` roots are conventional fail-closed destinations, **not a filesystem barrier**. The inspector creates no directories and changes no real HOME or config. It cannot prove that installed mise respects these destinations or avoids incidental reads, writes, scans, loading, migration or network access elsewhere.

### Exact proposed command — inert until separately approved

The parent extracted the exact repository-file command fence below and measured the identity recorded above. Bash and Node parse-only syntax checks and nine isolated version-predicate vectors passed; none executed the controller or mise. The vectors include LF/CRLF positives and extra-newline, missing-newline, extra-line and terminal-control negatives. No private control/prepared artifact was created or accessed. Static identity/syntax checks supply no execution permission, installed-version proof or containment. Immediately before any separately approved execution, re-extract and compare the exact command against the registered identity; mismatch stops without repair or fallback.

<!-- BEGIN F9 MISE VERSION COMMAND -->
```bash
(
  node --input-type=module <<'NODE'
import { execFile } from 'node:child_process';
let stdinError = false;
const child = execFile('/usr/local/bin/mise', ['--version'], {
  cwd: '/tmp/opencode', shell: false, encoding: 'buffer',
  timeout: 5000, killSignal: 'SIGKILL', maxBuffer: 8192,
  env: {
    PATH: '/dev/null', HOME: '/dev/null', TMPDIR: '/dev/null',
    XDG_CONFIG_HOME: '/dev/null', XDG_CACHE_HOME: '/dev/null',
    XDG_DATA_HOME: '/dev/null', XDG_STATE_HOME: '/dev/null',
    MISE_CONFIG_DIR: '/dev/null', MISE_SYSTEM_CONFIG_DIR: '/dev/null',
    MISE_GLOBAL_CONFIG_FILE: '/dev/null', MISE_DATA_DIR: '/dev/null',
    MISE_CACHE_DIR: '/dev/null', MISE_STATE_DIR: '/dev/null', MISE_TMP_DIR: '/dev/null',
    MISE_NO_CONFIG: '1', MISE_NO_ENV: '1', MISE_NO_HOOKS: '1',
    MISE_OFFLINE: '1', MISE_AUTO_INSTALL: '0', MISE_EXEC_AUTO_INSTALL: '0',
    MISE_AUTO_UPDATE: '0', MISE_SELF_UPDATE_AUTO: '0',
    MISE_DISABLE_UPDATE_WARNING: '1', MISE_DISABLE_HINTS: '*',
    MISE_CACHE_PRUNE_AGE: '0s', CI: '1', NO_COLOR: '1', LC_ALL: 'C'
  }
}, (error, stdout, stderr) => {
  const version = stdout.length <= 512 ? stdout.toString('utf8') : '';
  const observed = !error && !stdinError && stderr.length === 0 &&
    /^(?:mise )?[0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}(?: [\x20-\x7e]{1,384})?\r?\n(?![\s\S])/.test(version);
  const record = {
    protocol: 'F9_MISE_VERSION_V1', status: observed ? 'OBSERVED' : 'STOP',
    exitCode: child.exitCode, signal: child.signalCode,
    hadError: Boolean(error), stdinError,
    stdoutBytes: stdout.length, stderrBytes: stderr.length,
    stdoutBase64: stdout.subarray(0, 8192).toString('base64'),
    stderrBase64: stderr.subarray(0, 8192).toString('base64')
  };
  const line = JSON.stringify(record) + '\n';
  if (Buffer.byteLength(line) > 24000) {
    process.stdout.write('{"protocol":"F9_MISE_VERSION_V1","status":"STOP","reason":"OUTPUT_BYTES"}\n');
    process.exitCode = 3;
    return;
  }
  process.stdout.write(line);
  process.exitCode = observed ? 0 : 3;
});
child.stdin.on('error', () => { stdinError = true; });
child.stdin.end();
NODE
) 2>&-
```
<!-- END F9 MISE VERSION COMMAND -->

### Record interpretation, STOP and permission boundary

The parent must require one valid `F9_MISE_VERSION_V1` record, controller exit zero and no harness timeout before considering `OBSERVED`. An absent, malformed or inconsistent record, nonzero controller exit, harness timeout, any warning/stderr, parse failure, stdin error, child error or nonzero/signal termination means **STOP**. Keep only bounded base64 diagnostics in the parent result; do not silently retry or write a new receipt. Suppressed controller-startup stderr does not turn a missing record into success.

`OBSERVED` means **candidate version line only**. It establishes neither executable/build identity, backend capability, usability, positive native proof nor absence of incidental effects. A successful-looking line cannot bind the installed program to the cited upstream commit.

Any future approval must include the full exact command, parent-derived SHA-256, direct-child 5000 ms / outer-tool 8000 ms limits, per-stream/output limits, trust premises and explicit acceptance of residual startup-effects risk. Grant only this one-shot command. No retry, alternative command, execution of other found tools, install, acquisition, `use`, settings, self-update, global-config or repository-path change, receipt/control access or automatic next probe follows. Unanticipated effects or new prerequisites STOP the sequence; they do not expand authority.

Final read-only presentation reviews cover the current `87204ff1` packet, not execution or host-install approval:

| Reviewer | Final disposition |
|---|---|
| Adversarial `ses_ea0dbfc01ffedCnBcG2Lsv44wE` |Both LOW findings resolved; no remaining findings; READY TO PRESENT yes / DOCS READY yes. |
| Security `ses_ea0dbfc00ffeQvEYzI1DqhbiT5` |No new security findings; READY TO PRESENT exact explicit-risk decision yes / DOCS READY yes. Installed behavior and lead checks were not independently rerun. Residual risk remains medium. |

M1 is now **EXECUTED STOP / PRECHECK + COMMAND GRANT CONSUMED**, as reported by parent below. Host preparation, offline capture/build/runtime, preservation-compatible placement and all existing native/model/readiness gates remain unresolved. Frozen accepted N1–N10/bf38 text remains untouched.

## M1 recorded execution — STOP / grant consumed

**2026-10-21 · parent-reported outcome, not keeper verification.**

Parent reports that Executor selected **Approve one version probe** in the question containing the full exact 45-line command and registered digest above. Approval explicitly accepted residual startup filesystem/network risk, the trusted-host premise, the direct-child 5000 ms / outer-tool 8000 ms limits, 8192 bytes per child stream and the 24000-byte controller-record cap. It granted the immediate precheck and one command only, with no install, receipt access or automatic next operation.

Parent reports that it immediately read the repository M1 fence, checked exact equality/digest and printed `F9_MISE_VERSION_COMMAND_BYTES_OK`, then ran exactly that command once with outer timeout 8000 ms. Parent reported no harness timeout or truncation. The exact returned record was:

```json
{"protocol":"F9_MISE_VERSION_V1","status":"STOP","exitCode":0,"signal":null,"hadError":false,"stdinError":false,"stdoutBytes":32,"stderrBytes":52,"stdoutBase64":"MjAyNi45LjEgbGludXgteDY0ICgyMDI2LTA5LTAyKQo=","stderrBase64":"W1dBUk5dIG1pZ3JhdGU6IGZhaWxlZCBjcmVhdGVfZGlyX2FsbDogfi9taWdyYXRpb25zCg=="}
```

| Field | Parent-reported result |
|---|---|
| Protocol/status | `F9_MISE_VERSION_V1` / `STOP` |
| Child exit / signal | `0` / `null` |
| Controller exit | `3` |
| Child callback error / stdin error | `false` / `false` |
| Stdout / stderr bytes | `32` / `52` |
| Harness timeout / truncation | Neither reported |

Parent decoded the supplied buffers with pure JavaScript in `functions.execute`, without filesystem, process or receipt reads. The decoded strings, with their terminal LF represented as `\n`, were:

- Stdout: `2026.9.1 linux-x64 (2026-09-02)\n`
- Stderr: `[WARN] migrate: failed create_dir_all: ~/migrations\n`

The 52 stderr bytes require **STOP**, even though the child exited zero and printed a candidate version line. This is not `OBSERVED` or successful M1. The warning reports a failed `create_dir_all`; it does not prove that all incidental filesystem/network effects were absent. `~/migrations` is the displayed path only, not an established canonical destination; no real-home read is claimed.

The printed version line establishes neither installed executable/build identity nor backend capability or permission. **[Unverified] Installed identity, backend support and the extent of incidental startup effects remain unresolved.** This host-probe outcome adds no runtime/Native/readiness proof and validates no F9 recipe, capture or invoice.

The immediate precheck and one-command grant are **CONSUMED**. Parent reports no retry or following probe. Do not ignore stderr, retry, run help/backend queries, install Rust, acquire tools or access private controls/receipts. The selected host-exception planning direction still supplies no host-install packet approval.

If Executor directs further planning, the next unresolved work is version/backend source analysis and a separately reviewed bounded writable-state-root proposal. This record authors no new packet, selects no destination, asks no new approval and advances no operation. Capture, invoice, loading, resources and preservation-compatible routing remain open; accepted N1–N10/bf38 and the exact M1 command remain unchanged by these outcome edits.

## Current continuation — M2 planning packet, not another M1 attempt

Executor subsequently directed `continue, ignore the mise warning`. This permits continued planning using the printed `2026.9.1` only as a provisional source hint. It does not revise the M1 predicate, reclassify its STOP as PASS/OBSERVED, conceal stderr generally, renew either consumed grant or authorize a new probe/install. The recorded raw result and registered `87204ff1` command remain byte-exact.

The next proposal is [M2: exact JavaScript mise/Rust installation controller](native-ingress-mise-install.md), **NOT APPROVED / NOT RUN**. Parent supplies tagged `v2026.9.1` source research, explicit core Rust1.95.0+rustfmt/clippy syntax and immutable rustup/manifest metadata; these do not bind installed mise bytes or prove the fresh writable migration root works. M2 preinitializes pinned rustup to avoid the backend's mutable bootstrap and uses environment-only `MISE_OFFLINE=1`; rustup distribution acquisition remains proposed HTTPS network/install work.

M2 discloses its metadata/platform/capacity preflight, fresh private root and logs, literal child environment, deadlines, size/integrity checks and six post-install checks. Capacity is a point indicator, not quota proof; intended private writes and offline flags are not OS containment or per-origin denial. Parent measured exact controller/entry identities and passed parse/static/preservation checks. DevOps, Adversarial and Security returned READY TO PRESENT; fresh exact approval of the one-time N4 host-preparation exception and ordinary host-software residual trust remains pending. No M2 preflight, root creation, binary download, installation, renewed planning-direction question or private artifact followed. Host preparation is not the native window; accepted bf38,1048576/10s/300s and all F9 capture/runtime/resource gates remain unchanged. The historical M1 text above remains unchanged.

## Current outcome — M2 INSTALLED / one-time grant consumed

**2026-10-21 · parent-reported outcome, not keeper verification.** Executor selected exact M2 installation approval in the full-scope question naming the registered controller/entry identities, one-time N4 host-preparation network/install/private writes, preflight, eight children/six postchecks and root retention/no automatic retries. Approval explicitly accepted ordinary host-software trust without an OS sandbox, all-byte quotas, per-origin firewall or absolute kernel/process-tree guarantee.

Parent reports immediate fence-identity verification printed `F9_MISE_INSTALL_CONTROL_BYTES_OK`, then ran exactly the frozen30-line entry once with outer timeout750000ms. Controller exit was0; no timeout or truncation was reported. The [complete exact raw record and versions](native-ingress-mise-install.md#m2-recorded-execution--installed--grant-consumed) record `INSTALLED`, `stage:complete`, `ALL_CHECKS_PASSED`, `HOST_PREPARATION_ONLY`. Both installers and all six checks returned status0, signalnull, hadErrorfalse, timedOutfalse and overflowfalse. All intervening predicates passed, including pre-write metadata/platform/capacity checks, pinned bootstrap/manifest acquisition and copied-rustup hashing. These are the bounded run's results, not fresh continuing capacity or installed-byte-closure evidence.

The private root `/tmp/opencode/f9-host-rust-1.95.0-m2` now holds the reported private rustup/Cargo homes and `cargo/bin`; retain it and its logs without cleanup or reread. Bootstrap stderr436 and mise stderr636 are byte counts only; no contents were reread or classified as progress/warnings. Empty final `lastStderrBase64` describes only the target check, not zero stderr across the run. M2's prospective exit-zero-with-valid-checks policy does not revise M1's strict failed STOP.

The one-time N4 exception and precheck/entry/install/postcheck grant are **COMPLETED / CONSUMED**. No additional probe, rerun, root read/stat/hash, log read, old receipt/control access or automatic next operation follows. Parent reports no global config/shell-rc/persistent PATH change, other-tool installation, source/project changes, Cargo build/test/dependency acquisition, activation or deployment in this scoped operation; ordinary-host residual limits remain, rather than proof of OS-enforced absence of incidental effects.

Prior DevOps/Adversarial/Security reviews covered the pre-execution proposal. Parent reports final read-only M2 outcome-metadata reviews by Adversarial `ses_ea0a811beffewRd0ttWsG7sZKs` and Security `ses_ea0a810f6ffeX1V4Ly479u3npa`: no findings / DOCS READY yes for that documentation delta only, not independent runtime reruns or whole-batch publication reviews. F9 placement, exact current recipe/installed-byte allowlist/licenses/native libraries/readelf/broader usability/effective capacity/mixed audits/loading/full policy/actual daemon-init bytes/invoice/all418/fullR5 gates remain open. Future use/capture and exact commands require applicable approvals, not reuse of point-in-time PASS. Accepted bf38,1048576/10s/300s and frozen M1/M2 fences remain unchanged. M2 completes bounded host preparation only, not installed mise byte identity, a current runtime closure, capture/native authority, calibration, readiness or training.
