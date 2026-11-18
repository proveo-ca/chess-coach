# Read-only HOST access inspection

Executor selected `Publish + inspect (Recommended)` after packet2 source completion.
`authorization.json` grants one normal commit and one non-force push to existing PR51, followed by a USER-run HOST metadata command.
No permission/SELinux repair, HOST preparation, acquisition, installation, reference build, native/GPU/container training operation, or full campaign is authorized.

Run only the checked, literal command issued after publication.
The command uses the retained absolute Bun 1.4.0 interpreter with environment-file loading, installation and transpiler caching disabled.
It authenticates compressed transport, decoded source and the frozen plan before import.
It embeds the inspector; it does not fetch executable source during HOST inspection.
It prints one JSON report and writes no report file on HOST.
Paste its `Executor:` JSON output back, including a blocked report.
Exit 1 can indicate blocked metadata; it is not permission to repair anything.

The inspector observes caller UID/EUID/GID/EGID/groups, fixed volume ancestors, caller read/write/search access, three proposed roots, and fixed retained input/tool metadata.
`access(..., W_OK)` checks permissions without a write probe.
Only `ENOENT` establishes proposed-root absence.
Permission errors remain unknown observations.
It does not enumerate directories, hash/read retained payload contents, invoke retained native tools, query statfs/inodes, or run Docker/GPU commands.

SELinux observations consist only of bounded reads of `/sys/fs/selinux/enforce` and `/proc/self/attr/current`, plus one fixed `/usr/bin/ls -Zd -- ...` query on allowlisted observed targets.
Missing facilities remain unknown.
The label query has a one-second timeout, bounded output and a fixed clean environment.
The entire inspection retains one original 30-second deadline.
Each asynchronous observation gets at most one second without retries.
Output remains at most 32 KiB.

Caller access is not future-container access or SELinux compatibility proof.
Passing metadata is not HOST preparation, native qualification, training approval or a storage reservation.
Reported byte availability remains planning evidence; v2 runtime byte checks remain required.
Packet1, packet2, their bound source/spec bytes, native history, caches, partial workspaces and the protected original checkout remain unchanged.
The later checked publication record supersedes only this generation's prepublication status; it does not rewrite packet2's historical `LOCAL_UNCOMMITTED_UNPUBLISHED` issuance field.
