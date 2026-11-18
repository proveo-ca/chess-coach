# Disposable container access probe

Run the issued command once on the dedicated HOST volume, as the normal user, without sudo, and with no concurrent mount changes. The probe requires the repaired owner/mode and recorded volume identity, SELinux enforcing mode, and the observed `var_lib_t` context on the volume and the disposable directory and seed. It stops rather than relabeling if any precondition fails.

The probe uses only the retained packet2 image, with `--pull=never`, `linux/amd64`, `--network=none`, CPU-only `runc`, and UID/GID `1000:1000`. The only bind is the new private probe directory. The container's root filesystem is read-only. The shell reads the unique seed, exclusively writes the reply, and reads it back under `container_t`. The host confirms the reported process label and exit state, then verifies the reply. The probe does not use the NVIDIA runtime or mount retained inputs. A PASS applies only to the tested directory, context and CPU-only container, not to all campaign mounts or the future training container.

Each subprocess is time-bounded. Cleanup removes only a confirmed full container ID and the two fixed probe filenames in the owned private directory. If creation or removal is uncertain, cleanup leaves the directory and reports the exact probe name and path. Do not retry, prune, relabel, or manually clean up as part of this authorization. Return the `Executor:` line, including a blocked result, or report any startup or interruption error. A blocked result does not by itself establish a SELinux denial.

No campaign root, retained payload, capacity observation, or training state is touched. The command has no HOST source fetch. Its publication is not approval for subsequent HOST preparation or training.
