# SPEC: _spec/gate-closure.puml
import unittest

from tooling.runtime.backing_inventory import PAYLOAD_BYTES, partitions


class BackingInventoryTests(unittest.TestCase):
    def test_kernel_metadata_units_and_minimum_payload_do_not_imply_device_ownership(
        self,
    ):
        value = partitions("major minor  #blocks  name\n\n254 48 24576000 dm-3\n")
        self.assertEqual(
            value,
            [
                {
                    "name": "dm-3",
                    "device": "254:48",
                    "procCapacityBytes": 24576000 * 1024,
                }
            ],
        )
        self.assertEqual(PAYLOAD_BYTES, 219043332096)

    def test_malformed_duplicate_or_unbounded_metadata_fails_without_path_injection(
        self,
    ):
        for text in (
            "1 2 3 ../escape",
            "1 2 3 vda\n1 2 3 vda",
            "1 2 -3 vda",
            "\n".join(f"1 {i} 3 vda{i}" for i in range(129)),
        ):
            with self.assertRaises(ValueError):
                partitions(text)
