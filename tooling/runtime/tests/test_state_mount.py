# SPEC: _spec/checkpoint-runtime.puml
import unittest

from tooling.runtime.state_mount import DedicatedStateMount


class StateMountTests(unittest.TestCase):
    def test_c13_source_builds_only_the_exact_selected_private_mount(self):
        mount = DedicatedStateMount("/selected/private-training-state")
        self.assertEqual(
            mount.arguments(),
            [
                "--mount",
                "type=bind,source=/selected/private-training-state,target=/state,bind-propagation=rprivate",
            ],
        )
        mount.verify(
            [
                {
                    "Type": "bind",
                    "Source": mount.source,
                    "Destination": "/state",
                    "RW": True,
                    "Propagation": "rprivate",
                }
            ]
        )

    def test_missing_duplicate_substituted_readonly_or_extra_mounts_fail(self):
        mount = DedicatedStateMount("/selected/private-training-state")
        selected = {
            "Type": "bind",
            "Source": mount.source,
            "Destination": "/state",
            "RW": True,
            "Propagation": "rprivate",
        }
        for mounts in (
            [],
            [selected, selected],
            [{**selected, "Source": "/other"}],
            [{**selected, "RW": False}],
            [{**selected, "Propagation": "rshared"}],
            [selected, {"Type": "bind", "Destination": "/home"}],
        ):
            with self.assertRaises(RuntimeError):
                mount.verify(mounts)
        for source in (
            "/",
            "/home",
            "/tmp",
            "/selected/../escape",
            "/selected,readonly",
            "relative",
            "/selected\nother",
        ):
            with self.assertRaises(ValueError):
                DedicatedStateMount(source).arguments()


if __name__ == "__main__":
    unittest.main()
