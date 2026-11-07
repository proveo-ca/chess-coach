# SPEC: _spec/gate-closure.puml
import unittest

from tooling.runtime.host_view import mount_projection


class HostViewTests(unittest.TestCase):
    def test_projection_keeps_cgroups_and_writable_local_metadata_without_pseudo_or_tmpfs_targets(
        self,
    ):
        source = "\n".join(
            (
                "1 0 8:1 / / rw - ext4 /dev/disk rw",
                "2 1 0:1 / /sys/fs/cgroup ro - cgroup2 cgroup rw",
                "3 1 0:2 / /dev/shm rw - tmpfs shm rw",
                "4 1 0:3 / /proc rw - proc proc rw",
                "5 1 8:2 / /data\\040state rw - xfs /dev/data rw",
            )
        )
        value = mount_projection(source)
        self.assertEqual(
            [entry["mountpoint"] for entry in value],
            ["/", "/sys/fs/cgroup", "/data state"],
        )
        self.assertTrue(value[1]["cgroup"])

    def test_malformed_mount_records_fail_instead_of_selecting_a_guessed_path(self):
        with self.assertRaises(ValueError):
            mount_projection("not a mountinfo record")
