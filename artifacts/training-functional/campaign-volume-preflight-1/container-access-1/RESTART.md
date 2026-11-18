# Resume after restarting the coding sandbox

Continue on `feat-ml-adjuntant-ii`, [PR #51](https://github.com/proveo-ca/chess-coach/pull/51) against `main`, from a separate coding checkout. Do not switch, repair, or overwrite the protected original HOST checkout. Use `sbx` for transfer and isolated staging; the selected campaign still targets HOST Docker.

## Latest evidence and boundary

- [Disposable probe return](returned-1/user-return.stdout) and [replay receipt](returned-1/observation.json): Docker reported an empty pre-start `ProcessLabel`. The container never started. Cleanup of the container and disposable bind was confirmed in the return. No bind denial or compatibility result was established. **The one-shot probe authorization was consumed. Do not rerun `HOST-probe.sh`.**
- [Passive HOST diagnostic](daemon-diagnosis-1/HOST.md) and [local verification](daemon-diagnosis-1/verification.json) were published at `74d2cb4716f07d1b84137582a564284d558e6c3b`. The Executor approved a separate one-shot, read-only HOST run. The command was issued; no return had been received when this handoff was written.
- If the diagnostic already ran or was interrupted, return its `Executor:` line or the terminal error instead of rerunning it. Otherwise, it is the only pending HOST action. It does not invoke Docker, connect to its socket, or prove the live SELinux setting. Leave the service, configuration, and policy unchanged.
- Recovery, daemon or label changes, another container attempt, HOST preparation, and training all require a separate decision. Do not create campaign roots or run cleanup.

## Transfer and run the pending diagnostic

On HOST, identify the new coding sandbox with `sbx ls`. In the command below replace `SANDBOX_NAME` with that name. The source path assumes the same checkout location inside the new sandbox; use its actual checkout path if different. The checksum binds the file to the published diagnostic. This refuses an existing download rather than overwriting it.

```sh
test ! -e "$HOME/Downloads/HOST-daemon-diagnose.ts" &&
  test ! -L "$HOME/Downloads/HOST-daemon-diagnose.ts" &&
  sbx cp \
    'SANDBOX_NAME:/home/gu1lty/Projects/proveo/chess-coach/artifacts/training-functional/campaign-volume-preflight-1/container-access-1/daemon-diagnosis-1/diagnose.ts' \
    "$HOME/Downloads/HOST-daemon-diagnose.ts"
```

After a successful copy, or if the file already exists and the diagnostic has **not** been attempted, verify and run it once on HOST without `sudo`:

```sh
printf '%s  %s\n' \
  '4ecc15350fb9b4cb957fbda57a321617305c25d649ba89378c6367db5b2efedd' \
  "$HOME/Downloads/HOST-daemon-diagnose.ts" | /usr/bin/sha256sum --check &&
  /usr/bin/env -i PATH=/usr/bin:/bin HOME=/ LC_ALL=C BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 \
    /usr/bin/bash --noprofile --norc -c \
    'cd / && exec /usr/bin/timeout -k 2s 20s "$1" --config=/dev/null --no-env-file --no-install "$2"' \
    _ /home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun \
    "$HOME/Downloads/HOST-daemon-diagnose.ts"
```

Return the single `Executor:` line, or the terminal error if none appears.

## Retention limits

Keep [packet1](../../full-training-packet-1/) and [packet2](../../full-training-packet-2/) frozen. Do not regenerate packet1 against current source. The last local packet2 pin replay matched 198 of 199 inputs. The missing historical input was `artifacts/training-functional/scratch/reference-prep-2/bundles/packages/starchess-arena/src/players/strategic.ts` (115300 bytes, SHA-256 `f48eb1a6016202272d609f373718c33ca2f4dba13b7d9ebe7499be4960b36499`). Keep that gap explicit; do not substitute another file.

The selected external storage is `/var/lib/chess-coach/training-volume-1` on HOST. `/mnt/training` was only its sandbox view. HOST caches and partial workspaces do not live in this Git checkout. Preserve them in place. Do not resume the halted LLVM work or reuse the failed writable full1 cache.
