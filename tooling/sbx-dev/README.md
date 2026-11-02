# Development-only sandbox preparation

These `mise` tasks are **convenience commands**, not F9 host guards or authority. They do not run automatically. They use the operator's existing local `sbx` service and configuration. Creation requests built-in `shell` with `--pull never`, without explicitly naming the separately listed imported `shell-docker` tag. The actual selected image and its provenance are unverified. This workflow does not satisfy dedicated-service routing, effective quotas, provenance, Gate0, G1, KUnit, Native or `trainingReady:true`.

Request a **fresh exact host/VM-operation approval** for each task invocation. `dev:sbx:create` lists names, creates one mountless sandbox with a generated name using built-in `shell`, `--pull never`, `--skills off`, deny-network `**`, 2 CPUs and 4 GiB requested memory, and lists names again. Only the explicit `--template` argument differs from the failed create; the earlier successful smoke also used fewer requested resources. No workspace, host cache, home or Docker socket is mounted by this task. It does not run `sbx run`, reset the service, install tools, or remove a VM. A failed or timed-out creation prints an unconfirmed name; do **not** retry or remove it until an operator reconciles actual state. Successful creation prints `DEV_CREATED_NAME=…`; save it.

The `/absolute/path/to/sbx` string in earlier examples was a **placeholder**, not a working path. Locate the installed executable from Fish without invoking `sbx`:

```fish
which sbx
```

After separate approval for that exact creation attempt, use its resolved path (`realpath` handles an executable symlink):

```fish
mise run dev:sbx:create -- --sbx (realpath -- (which sbx))
```

Prepare a **guest-compatible, offline tar archive** on the host with only regular files and directories rooted at `bin/` and `lib/` (or other necessary relative toolchain subdirectories). It must contain executable `bin/rustc` and `bin/cargo` for Linux x86_64, both version 1.95.0; `bin/rustc` must carry its needed relative libraries. No credentials, host Cargo cache, repository checkout or `.env` belong in the archive. Provide an independently reviewed lowercase SHA-256 digest. The host checks the digest, rejects links, special files, duplicate members, absolute/traversal paths and oversize archives; the guest checks the digest again before extraction into its private `/home/agent/workspace/devrust-tools`. The task copies only that archive and the fixed guest entrypoint. It executes the entrypoint inside the VM, which can start a stopped VM. It performs **no network package install**, Cargo fetch, or test. It does not claim offline dependency availability.

After inspecting the creation result and obtaining **separate approval for one seed attempt**, run from Fish:

```fish
mise run dev:sbx:seed -- --sbx (realpath -- (which sbx)) --name REPLACE_WITH_DEV_CREATED_NAME --bundle /absolute/path/to/rust-tools.tar --sha256 REPLACE_WITH_REVIEWED_64_HEX_DIGEST
```

Before seeding, independently inspect effective sandbox network rules, including kit rules, with an **individually approved** `sbx policy ls --wide NAME`; a requested deny flag alone does not establish policy enforcement. The task does not perform that inspection or certify the rules. A failed/ambiguous copy or exec leaves the VM and any copied files in place for operator reconciliation; it never automatically removes, retries or cleans them. The guest directory persists across VM stops until removal; seeding again refuses if the tools directory already exists. `sbx exec` may start a stopped VM. Every follow-up (connection, cache transfer, fetch, tests, removal) needs its own approval. The private Cargo stage previously created on the host remains on the host and is not used by these tasks.

Offline, fake-CLI validation (never contacts `sbx`):

```fish
env PYTHONDONTWRITEBYTECODE=1 TMPDIR=/tmp/opencode python3 -m unittest discover -s tooling/sbx-dev/tests -p 'test_setup.py'
```
