# Dedicated volume repair and recheck

Run `repair.sh` only on HOST, as the normal operator, after the checked publication and after confirming the currently mounted volume is the dedicated campaign volume. Do not run it while the mount is being changed. The prior report did not record a device/inode. Do not use an outer `sudo`.
The script changes only the volume directory itself. It tightens mode to `0700` before transferring ownership to `1000:1000`. These changes are not atomic. If any step fails, report the error and stop rather than retrying or rolling back.

After repair succeeds, run the issued read-only Bun recheck without `sudo`. It checks effective and real identity, caller read/write/search access, absence of all three proposed roots, and the volume's label. It compares parent identity, mode, and modification/change timestamps after the label query, and discards absence and label claims on observed drift. This is a metadata observation, not an atomic snapshot or reservation. The Bun subprocess result accepts both `undefined` and `null` for no signal. An unobserved label causes a nonzero exit even if the access and root checks pass. Return the JSON in either case. An observed label is not a container-access test.

No recursive change, SELinux policy or label change, write probe, root creation, data preparation, capacity query, Docker/GPU command, or training is authorized. The earlier report and all packet2 bytes remain immutable. The new publication authorizes no further action beyond the selected repair and recheck.
