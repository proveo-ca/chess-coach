# One passive HOST daemon diagnosis

[Contract](../../../../../_spec/training-daemon-diagnosis.puml) · [Blocked probe observation](../returned-1/observation.json) · [Runtime choice](../returned-1/runtime-choice.md)

Copy only the checked `diagnose.ts` from the coding sandbox with `sbx cp`. Verify its separately issued SHA-256. Run it once from `/` on HOST with the retained Bun 1.4.0 as UID/GID `1000:1000`, without `sudo`. Use an empty environment with fixed variables, `/dev/null` as Bun config, no install or env file, and a 20-second deadline plus 2-second kill grace. Do not run it with `sbx exec`.

The diagnostic brackets two samples of the running root-owned `dockerd` process with `docker.service` snapshots. The reported SELinux token and config path classification are argument evidence, not the daemon's interpreted or effective settings. It accepts at most 64 KiB of JSON from the fixed `/etc/docker/daemon.json` if applicable, and reports only the parsed boolean or its status. It never reads a custom config. An absent token or on-disk key is not a live SELinux setting. The service start time may rule out an invocation that started after the original probe; an earlier start does not establish it is the same daemon or that it serves the original socket.

Do not start a service for this check. Keep service and config unchanged during the sample. The collector never invokes Docker or connects to its socket, so it cannot socket-activate Docker. It neither reads nor writes the training volume. Return the `Executor:` line or the terminal error. Blocked or interrupted results do not authorize a retry, cleanup, daemon or policy changes, preparation, or training.

Upstream example only: Moby v28.5.2 [sets security options during create](https://github.com/moby/moby/blob/v28.5.2/daemon/create.go#L226-L234) and [exposes the stored process label](https://github.com/moby/moby/blob/v28.5.2/daemon/inspect.go#L159-L160). The HOST build is not established by this diagnostic.
