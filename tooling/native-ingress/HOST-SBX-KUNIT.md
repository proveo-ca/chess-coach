# Host-run `sbx` custody KUnit · conditional operator packet

These scripts **do not** run on the current realm. Run them on the Fedora host only after separately approving the host operation and reviewing the independent guard and provenance verifier. Docker documents Ubuntu 24.04+ for local `sbx`; Fedora host behavior is not established by this packet. No GitHub access is needed by the scripts.

## Stage inputs without mounting the checkout

Place only these files in an operator-controlled, quota-enforced absolute `INPUTS` directory on the host:

| Name | Requirement |
| --- | --- |
| `linux-6.16.tar.xz`, `linux-6.16.tar.sign` | kernel.org signed archive and detached signature |
| `llvm-20.1.8-x86_64.tar.xz`, `llvm-20.1.8-x86_64.tar.sign` | kernel.org signed archive and detached signature |
| `linux-kernel.gpg`, `llvm-kernel.gpg` | independently authenticated keyrings, with externally registered hashes |
| `linux-6.16-original-custody.patch` | exact repository patch, hash registered outside `INPUTS` |
| `tools.tar`, `zig` | reviewed dependency closure and Zig 0.14.1 executable, hashes registered outside `INPUTS` |

The guard must authenticate signed Ubuntu package indexes and exact `.deb` hashes, Zig provenance and the tool/runtime closure **before creating a VM**. The required `F9_PROVENANCE_VERIFIER` is an operator-supplied, independently reviewed executable that checks these facts inside the guarded envelope and rejects incomplete inputs. A hash supplied alongside an untrusted archive cannot authenticate it. The two keyring hashes, three artifact hashes, verifier hash and guard hash must come from a separately approved record, **not** `sha256sum` computed from transferred inputs on the day of the test.

## Operator prerequisites (no host operation is authorized here)

After reviewing and approving the exact source bytes, install `host-sbx-preflight.sh` and `host-sbx-kunit.sh` as root-owned regular files in `/opt/f9/native-ingress/`. Keep that directory and every parent root-owned and non-writable by other users. Do not install from an unreviewed checkout. Independently register each installed script's SHA-256 in the approval record. The npm aliases use absolute `/usr/bin` tools, check these two hashes before invoking the root-owned copies, and restrict the script `PATH` to `/usr/local/bin:/usr/bin:/bin`. **These aliases are convenience commands, not a security-valid host launch:** npm can run checkout-defined `pre*` lifecycle hooks before an alias. No host invocation is prescribed for the selected separate-identity design until the service routing, installed guard and verifier are accepted.

After separate operator approval for host installation, an operator can copy the reviewed scripts from a trusted checkout with:

```sh
sudo install -d -o root -g root -m 0755 /opt/f9/native-ingress
sudo install -o root -g root -m 0755 tooling/native-ingress/host-sbx-preflight.sh /opt/f9/native-ingress/host-sbx-preflight.sh
sudo install -o root -g root -m 0755 tooling/native-ingress/host-sbx-kunit.sh /opt/f9/native-ingress/host-sbx-kunit.sh
```

Do not run the installation commands from this realm or treat the resulting files as independently registered merely because they were copied.

```sh
export F9_PATCH_SHA256='<independently registered SHA-256>'
export F9_TOOLS_SHA256='<independently registered SHA-256>'
export F9_ZIG_SHA256='<independently registered SHA-256>'
export F9_LINUX_KEYRING_SHA256='<independently registered SHA-256>'
export F9_LLVM_KEYRING_SHA256='<independently registered SHA-256>'
export F9_PROVENANCE_VERIFIER='/absolute/path/to/reviewed-provenance-verifier'
export F9_PROVENANCE_VERIFIER_SHA256='<independently registered SHA-256>'
export F9_HOST_GUARD='/absolute/path/to/reviewed-host-guard'
export F9_HOST_GUARD_SHA256='<independently registered SHA-256>'
export F9_HOST_PREFLIGHT_SHA256='<independently registered installed preflight SHA-256>'
export F9_HOST_RUNNER_SHA256='<independently registered installed runner SHA-256>'

# Hash checks for a future approved host entrypoint; do not run the KUnit script yet.
set -e
unset BASH_ENV ENV NODE_OPTIONS LD_PRELOAD LD_LIBRARY_PATH
export PATH=/usr/local/bin:/usr/bin:/bin
printf '%s  %s\n' "$F9_HOST_PREFLIGHT_SHA256" /opt/f9/native-ingress/host-sbx-preflight.sh | /usr/bin/sha256sum -c -
printf '%s  %s\n' "$F9_HOST_RUNNER_SHA256" /opt/f9/native-ingress/host-sbx-kunit.sh | /usr/bin/sha256sum -c -
```

For developer convenience only, the root `package.json` exposes `npm run host:sbx:preflight -- "$INPUTS"` and `npm run host:sbx:kunit -- "$INPUTS" "$EVIDENCE"`. Do **not** use these aliases as evidence of the approved host boundary or run them on the existing daemon for this test. `INPUTS` and `EVIDENCE` must be existing, distinct absolute directories. The preflight checks fixed archive hashes, detached signatures against independently pinned keyrings and exact signer fingerprints, and registered patch/tool/Zig hashes. It locates `sbx` but does **not** query the existing daemon or establish a dedicated one. The guard must run preflight and the provenance verifier inside its deadline and quotas; standalone preflight does not prove that envelope. Install the verifier and guard at absolute paths owned by root, without symlinks or group/world-writable parent directories, and register their hashes independently; this prevents a host user from swapping their files between verification and execution. The runner checks those installed executables and the preflight digest, then delegates to the guard **before** validating large inputs; the guard must fail before `sbx create` unless both checks succeed. Neither external executable is supplied in this repository; **do not replace either with a stub that returns success**.

## Required `F9_HOST_GUARD` contract

The guard receives `--inputs ABS --evidence ABS --preflight ABS --verifier ABS --patch ABS --filter 'exec.exec_test_original_custody*'`. It must own the complete host-to-VM sequence:

1. Start the independent deadline and quotas **before** invoking the passed preflight and provenance verifier. Independently recheck staged bytes after copying, verify the *fresh* source extraction, exact patch application without fuzz, the atomic admission and two-caller case, and the archived stack-limit fix. Use signed v6.16, LLVM 20.1.8, authenticated Ubuntu dependencies, verified Zig 0.14.1 and GNU BFD. Do not pull packages during the KUnit run.
2. Check the **dedicated namespace's** `sbx` version and diagnostics, KVM and effective policies without addressing the existing daemon. Create a uniquely named **mountless** `shell` microVM (requires `sbx` ≥0.42.0); do **not** use `sbx run` from the repository, direct or clone workspaces, shared skills, host Docker sockets, host `/proc`, host home, broad host system mounts, or a host daemon inside the VM. Pin the shell template. Deny egress explicitly, including kit-supplied rules; do not rely on the `deny-all` preset alone.
3. Independently enforce a reviewed aggregate host envelope covering preflight, provenance verification, VM, daemon, input staging, logs and cleanup: peak CPU/RSS/PIDs/FDs, finite disk/output including extraction, a ≤20-minute total deadline with bounded stop/remove before deadline, at most two build jobs, and a ≤60-second KUnit test timeout. Guest cgroups and VM `--cpus`/`--memory` are not a substitute for host bounds. Prove the effective guest CPU/memory/PID/FD limits and the 3 GiB `/out` ceiling before launching the test. Refuse if host delegation, disk quotas, effective limits, or the watchdog are unavailable.
4. Run the exact filtered command in `_spec/_plans/native-ingress-r-out-kernel-core-custody.md`, using the reviewed compiler wrapper and GNU BFD, **not** the historical LLD-only flag. Require exit 0, exactly `exec_test_original_custody` and `exec_test_original_custody_two_callers` passed, no skips/truncation, and a retained bounded log. Confirm VM and child removal on every path, including partial creation and timeouts; `sbx stop` alone preserves state. Refuse a PASS when cleanup cannot be confirmed.

The selected delegated-cgroup blocker in the plan remains open until an independently reviewed host supervisor actually supplies equivalent host limits and the operator accepts that change. A post-atomic synthetic KUnit PASS is not a booted kernel, G1, actual 5c, Native/5d, or `trainingReady:true`. The original S0+10s, S0+300s (final 3s cleanup), N1–N10 and shared DIRECT meter remain unchanged.

## Selected dedicated-service design · v0.50.0 · STOP

Executor supplied Fedora-host `sbx version v0.50.0`, `create`/`exec`/`cp` help, a healthy `sbx diagnose` with accessible KVM and working storage, and `sbx policy ls` showing existing kit allow rules and a global allow. These operator-provided results show a functioning **existing** daemon, not an isolated F9 daemon, a VM launched for this job, enforced quotas or a post-atomic test. Docker's published Linux installation support still names Ubuntu 24.04+; do not infer Fedora support for a new dedicated service from the existing daemon's health.

The selected **candidate** is a separate operator-provisioned `sbx` service under a distinct Unix identity with its own `HOME`, private XDG state/cache/config/data/runtime roots, separate credentials and policy, and a quota-enforced host slice. Docker documents [Linux XDG state directories](https://docs.docker.com/ai/sandboxes/troubleshooting/#removing-all-state), but does not establish that overriding them separates **every** v0.50.0 socket, shim and VM. Executor's v0.50.0 top-level and daemon-start help do **not advertise `--app-name`**. Older [v0.29.0 release notes](https://github.com/docker/sbx-releases/releases/tag/v0.29.0) and [Testcontainers for Go documentation](https://golang.testcontainers.org/system_requirements/using_sbx/) mention that flag but do not establish its presence or isolation semantics on this installed binary. Do not assume user separation alone suffices, invent a socket flag, copy the existing user's credentials, or reuse the existing daemon.

Before implementing or approving the external guard, independently establish all of these on the Fedora host without disturbing existing sandboxes:

1. Specify a dedicated Unix identity and separate `HOME`, `XDG_STATE_HOME`, `XDG_CACHE_HOME`, `XDG_CONFIG_HOME`, `XDG_DATA_HOME` and `XDG_RUNTIME_DIR` that cannot resolve through symlinks into the existing user's paths or accept writes from that user. Confirm actual v0.50.0 daemon/socket/credential/policy paths and prove every dedicated daemon, version, policy, template, create, copy, exec, stop and remove invocation reaches **only** the new service. Refuse if a dedicated CLI can reach the existing daemon, or vice versa. Establish KVM access for the **new** identity; the current user's accessible `/dev/kvm` does not suffice. Authenticate it only after separate credential-handling approval, without importing existing secrets.
2. Have the operator provision an independent host service/slice and storage quota. Measure effective CPU, memory, task and **aggregate** FD bounds on the actual daemon, CLI, VM/shim, staging, log and cleanup processes, including any process outside the proposed cgroup. `CPUQuota=` bounds rate, not total CPU-seconds; `LimitNOFILE=` bounds each process, not aggregate FDs. Prove a finite hard byte **and inode** ceiling over dedicated state, VM disks, source/tool extraction, `/out` (3 GiB) and evidence. Free disk space is not a quota.
3. Freeze an offline, pinned shell template and approved provisioning method. In v0.50.0 `sbx create` defaults to pulling an agent image unless the specific template is a saved snapshot; require explicit `--pull never` for the bounded run. Create with **no workspace path**, `--skills off`, no host mounts, no MCP, explicit CPU/memory values and a sandbox-scoped `--deny-network '**'` from creation. Inspect effective policy, including kit rules, and prove the deny prevails before transferring inputs. Do not use cloud-only `--ttl` as local cleanup or assume `--cpus` is CPU-time accounting.
4. Start a host watchdog **before** preflight, provenance verification and service/VM preparation, reserve bounded cleanup inside the 20-minute total, and verify removal of only the owned sandbox on success, partial creation, timeout, signal and quota failure. Never stop, restart, reset or prune the existing shared daemon or its other sandboxes. Refuse PASS if any dedicated child survives or quota/cleanup evidence is missing.

The supplied help outputs establish only visible v0.50.0 flags; they do not prove routing, containment, or a runnable verifier. Any later two-identity routing or cgroup probe needs a **separate exact host-operation and credential-handling decision** before service provisioning, daemon start, policy change or input transfer. No dedicated identity, service, guard, verifier, host quota or host-operation approval is supplied by this document; the existing runner must still STOP.
