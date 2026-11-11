# C2 headroom inventory request

Status: C3 COMPLETED / METADATA ONLY / GRANT CONSUMED.

Executor selected `Read-only probe (Recommended)` for the exact request below.
Executor subsequently supplied a hard aggregate ceiling of 24 GB RAM / 12 CPU threads on the reported 40 GB / 16-thread host.
This read-only receipt cannot increase those operator limits or C2's selected 4 CPU / 8 GiB job envelope.

## Actual receipt

The two exact CLI invocations passed once each in 78.161 ms total.
Both exited 0 with natural stdout/stderr EOF and child reap.
No timeout, retry, forced cleanup, container creation or image operation occurred.
Private evidence remains in `/tmp/opencode/chess-coach-ii-headroom-inventory-4VrUut/` with `result.json`, each projected output/receipt and `evidence-sha256.json`.

| Selected field | Observed value |
|---|---|
| Docker client / server | 29.7.2 / 29.7.2 |
| Server API | 1.55 |
| Daemon-reported CPUs | 16 |
| Cgroup driver / version | cgroupfs / 2 |
| Retained query stdout/stderr | 25 bytes for version; 30 bytes for capacity |

Do not persist sampled RAM figures as planning limits or use them to override the 24 GB / 12-thread hard ceiling.
Available headroom and physical fit require a current admission check, not a historical memory sample.
This request's execution grant is consumed; another query needs a fresh grant.

## Purpose

Executor selected aggregate design ceilings of 4 CPU, 8 GiB RAM with no extra swap, 512 tasks and 2 GiB tmpfs within RAM.
The earlier synthetic proof did not inventory capacity for this envelope.
Request a fresh read-only daemon-capacity/component receipt before the final Gate0 physical-fit packet.
Do not reuse the consumed proof or read-only grants.

## Exact proposed scope

Run at most these two Docker CLI invocations once each, using `/usr/bin/docker`, explicit `unix:///var/run/docker.sock`, a new empty private Docker configuration/home under `/tmp/opencode/`, and no saved context or authentication.
Permit the CLI's ordinary read-only API negotiation/handshake calls.
The `/info` API response can contain wider daemon metadata; the CLI projects only the four selected fields.
Do not retain or inspect the unprojected response or use it to investigate workloads.

```text
/usr/bin/docker --config NEW_EMPTY_CONFIG --host unix:///var/run/docker.sock version --format '{{json .Client.Version}} {{json .Server.Version}} {{json .Server.APIVersion}}'
/usr/bin/docker --config NEW_EMPTY_CONFIG --host unix:///var/run/docker.sock info --format '{{json .NCPU}} {{json .MemTotal}} {{json .CgroupDriver}} {{json .CgroupVersion}}'
```

Keep inherited credential/context/TLS configuration out of the child environment.
Keep proxy environment out of the explicit local-socket query.
Bound the Docker CLI's Go scheduler with `GOMAXPROCS=2`; do not report that setting as a CPU-affinity proof.
Retain only selected output, bounded error output, exit/timeout/cleanup facts and command identities in the private evidence directory.

Bound each CLI invocation to 10 seconds with a further 2-second owned-client kill/reap allowance.
Bound combined stdout/stderr to 64 KiB per invocation.
Bound the complete request to 30 seconds plus 2 seconds for owned-client cleanup.
Stop on failure; do not retry or substitute another socket/backend.
Terminate only the owned query process group if needed.
Retain its failed receipt and private scratch rather than deleting historical evidence.

## Excluded operations

Do not list, inspect, start, stop, remove or otherwise touch any existing workload.
Do not create a container, pull/build/export an image, run a game, inspect secrets, read Docker credentials, configure the daemon or change host policy/permissions.
Do not issue unformatted daemon-info, workload-count/list/inspect, root-tree, `/proc`, log or unrelated-file queries.
This request grants no runtime capture, image build, effective-controller stress, init-byte capture, native proof or training.

## Meaning of the result

Reported CPU count and total daemon-host memory are capacity metadata.
They do not establish currently unused capacity, parent cgroup limits, storage fit, actual 4 CPU / 8 GiB enforcement, tmpfs behavior, descendant membership, runtime identity, deadline cleanup or cgroup disappearance.
Keep those separate obligations open even if the report exceeds C2 ceilings.
Executor may instead supply an operator-owned capacity receipt or defer host discovery while source work continues.
