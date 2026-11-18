# SPEC: _spec/gate-closure.puml
import unittest

from tooling.runtime.host_inventory import calculate, cpu_ids, json_values


class HostInventoryTests(unittest.TestCase):
    def test_projected_json_values_preserve_spaces_without_accepting_extra_fields(self):
        self.assertEqual(
            json_values('"daemon" 16 "Debian Linux"', 3), ["daemon", 16, "Debian Linux"]
        )
        with self.assertRaises(ValueError):
            json_values('"daemon" 16 17', 2)

    def test_cpu_calculation_never_promotes_a_different_realm_to_daemon_host_authority(
        self,
    ):
        observed = {
            "/proc/sys/kernel/hostname": {"value": "sandbox\n"},
            "/sys/devices/system/cpu/online": {"value": "0-15"},
            "/sys/devices/system/cpu/present": {"value": "0-15"},
            "/sys/fs/cgroup/cpuset.cpus.effective": {"value": "2-15"},
            "/proc/self/status": {"value": {"Cpus_allowed_list": "4-15"}},
        }
        result = calculate(
            [
                "daemon-host",
                16,
                40_000_000_000,
                "cgroupfs",
                "2",
                "/var/lib/docker",
                "Linux",
                "kernel",
            ],
            observed,
        )
        self.assertEqual(result["daemonHostObservationBinding"], "MISMATCH")
        self.assertEqual(result["realmCandidateCpuIds"], list(range(4, 16)))
        self.assertIsNone(result["approvedHostCpuIds"])
        self.assertFalse(result["trainingReady"])
        self.assertEqual(result["persistentPayloadCeilingBytes"], 200 * 1024**3)

    def test_cpu_ranges_are_bounded_without_allocating_arbitrary_domains(self):
        self.assertEqual(cpu_ids("2,4-5"), [2, 4, 5])
        for value in ("0-9999999999", "4-2", "-1", ""):
            with self.assertRaises(ValueError):
                cpu_ids(value)
