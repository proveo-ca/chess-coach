# Development-only `sbx` smoke

`host-smoke.sh` runs a **no-input, no-KUnit** CLI check on the existing shared daemon. It is not a host guard, service-isolation check, provenance check, or F9 Gate0/G1/5c/Native result. It uses the operator's existing `HOME` and `sbx` configuration; it does not inspect credentials. **Request fresh approval for one exact invocation before using it on the host.** The earlier smoke approval covered only the failed attempt. No `mise` task invokes this script.

The required `--confirm-dev-shared-daemon` flag acknowledges the selected development scope; it is not host authorization. Pass an absolute path to the installed `sbx` executable using `--sbx`. The optional `--create-seconds` lowers the default 60-second creation deadline for tests or a separately approved invocation. The script lists names, generates a random name, creates a mountless `shell` sandbox with `--pull never --skills off --deny-network '**' --cpus 1 --memory 512m`, executes `/bin/true`, removes **only the confirmed owned name**, then checks it is absent from a complete names-only listing. Create, exec, listing and removal use `timeout --kill-after=2s`. It never uses `rm --all` or attempts removal after ambiguous creation.

`ATTEMPT_NAME` identifies the attempted name, not a confirmed VM. `CREATE_UNCONFIRMED_NAME` and `OWNERSHIP_UNCONFIRMED_NAME` require operator reconciliation, not a retry or automatic removal. `REMOVE_UNCONFIRMED_NAME` requires reconciliation even if the removal request exited successfully. `NAME_ABSENT_AFTER_RM` means only that the name is absent from a completed names-only listing. `RESULT=DEV_SMOKE_ONLY` requires successful create, exec, removal request and final listing; it proves only those CLI operations, not host containment or cleanup of transient artifacts. Network-deny effectiveness and kit behavior are not proved by this smoke.

Run the fake-CLI suite without the real daemon:

```sh
PYTHONDONTWRITEBYTECODE=1 TMPDIR=/tmp/opencode python3 -m unittest discover -s tooling/sbx-smoke/tests -p 'test_host_smoke.py'
```
