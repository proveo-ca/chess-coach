# C19 proposal: read-only visible backing capacity

Status: AUTHORIZED BUT UNEXECUTED / PAUSED AFTER EXECUTOR'S SBX/HOST SCOPE CORRECTION.

Executor selected the exact C19 read-only scope, then clarified that this session is sbx and the host can provision 200gb of disk.
No C19 device read occurred.
Do not consume a sandbox-local device inventory as host-capacity discovery.
The active next step is tighter pipeline sizing and a host-side provisioning interface, not another sandbox capacity conclusion.

C18 selected separate private backing.
The historical request compared visible devices with the 204 GiB sum of configured payload ceilings.
The active enforced fixed-pipeline free-usable proposal is 191,396,683,776 bytes with an 8 GiB planning allowance; see [storage-admission-decision.md](storage-admission-decision.md).
C16/C17 observed sbx-local filesystems only.
This scope checks only whether visible block-capacity candidates exist.
It never certifies that a device is empty, unused, owned, safe to format or approved for reuse.

## Exact allowlist

The following authorized scope remains historical and unexecuted.
Do not execute or silently rewrite it into a host provisioning grant.

Use one bounded Python standard-library helper.
Read `/proc/partitions` once, at most 64 KiB.
Parse at most 128 data records.
Accept only kernel device names matching `[A-Za-z0-9_-]+`.
For only those listed names, read at most once each of `/sys/class/block/NAME/dev`, `size`, `ro`, and `partition`, at most 4 KiB per metadata file.
Absent/denied `partition` or metadata files remain explicit in the receipt.
Open no path under `/dev`.
Run no `blkid`, filesystem probe, SMART command or block-content read.
Perform no directory walk, Docker call, process/workload listing, allocation, mount, formatting or write to a host/controller/device path.

Create only a fresh private evidence directory under `/tmp/opencode/`.
Bound the attempt to 10 seconds plus 2 seconds for owned-helper kill/reap.
Bound retained output to 128 KiB.
Stop on malformed/exhausted input or deadline without retry or escalation.
Compare capacities with 219,043,332,096 bytes and report candidate identities/capacities only.
Use retained C17 major/minor metadata to flag known mounted devices, not to infer that every other device is unused.

If no candidate exists, require an operator-provided existing/new backing or approved infrastructure interface.
Do not simulate missing capacity with a sparse file or modify the preserved reference filesystem.
