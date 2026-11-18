# Selected HOST volume metadata

Executor selected `/var/lib/chess-coach/training-volume-1` on HOST and reported it mounted at `/mnt/training` in coding sandbox `proveo-opencode-11c4aed0`.
The recorded coding-SBX observation does not establish HOST capacity or inode availability.

The next user-run command inspects only the selected HOST directory with `lstat` and, for a directory leaf, `statfs`.
It reports mode/ownership and raw filesystem counters without reading payload contents or writing files.
It rejects a symlink or non-directory leaf before `statfs`.
Available bytes must reach 283467841536 and exposed free entries must reach 835600.
Zero total/zero free entry counters remain unknown, not zero.
The comparison results distinguish unknown from insufficient.

The existing immutable handoff renderer supplies sanitized Bash startup, neutral cwd, absolute retained Bun1.4.0, disabled transpiler cache, and literal source/plan hashes checked before evaluation.
The retained original plan supplies budget/request context only.
The new inspector always targets the fixed HOST path, never that plan's old runs directory or `/mnt/training`.
The 2-second observation and 5-second overall deadlines are cooperative, not kernel-call cancellation guarantees.

Publish this source-only handoff and retained intake through one normal commit/non-force push to existing PR51 before delivering the HOST command.
This fresh selected-volume verification does not reuse the consumed prior publication grant.
Do not amend, force, retry automatically, or create another PR.
The final command carries the checked publication OID outside committed/hash-bound records.

PASS covers metadata preconditions only.
It does not prove quota, reservation, effective-user write/search access, container access, SELinux compatibility, or executable usability.
No SELinux label/policy change, preparation, root relocation, new worker packet, cleanup, Docker/GPU/native operation, or training follows from this check.
Preserve the old packet, source closure, admission rules, readiness flags, original checkout, caches, LLVM/full1 work, partials and historical receipts.
