import os
from pathlib import Path
import subprocess
import tempfile
import tomllib
import unittest


ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / "tooling/native-ingress/f9-status.sh"
TASK = tomllib.loads((ROOT / "mise.toml").read_text())["tasks"]["f9:status"]


class OfflineStatusTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(dir="/tmp/opencode")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for name in ("sbx", "mise", "cargo", "systemctl", "curl", "python3"):
            fake = self.root / name
            fake.write_text('#!/bin/sh\nprintf called >> "$POISON_MARKER"\n')
            fake.chmod(0o755)
        self.env = {
            **os.environ,
            "PATH": str(self.root),
            "POISON_MARKER": str(self.root / "called"),
            "F9_HOST_GUARD": str(self.root / "sbx"),
            "F9_PROVENANCE_VERIFIER": str(self.root / "sbx"),
            "F9_DEDICATED_UNIT": "claimed-ready.service",
        }

    def invoke(self, *args):
        return subprocess.run(
            ["/usr/bin/bash", "-p", str(SCRIPT), *args],
            env=self.env,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )

    def test_fixed_stop_even_with_claimed_provider_environment(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stderr, "")
        self.assertEqual(
            result.stdout.splitlines()[0:3],
            [
                "F9_OFFLINE_STATUS_V1",
                "MODE=STATIC_PREREQUISITES_ONLY",
                "EVIDENCE=NOT_INSPECTED",
            ],
        )
        self.assertIn("GATE0=REQUIRES_ACCEPTED_PLAN", result.stdout)
        self.assertIn(
            "5D_NATIVE=REQUIRES_SEPARATE_APPROVAL_AND_NATIVE_PROOF", result.stdout
        )
        self.assertEqual(
            result.stdout.splitlines()[-2:], ["TRAINING_READY=false", "RESULT=STOP"]
        )
        self.assertNotIn("PASS", result.stdout + result.stderr)
        self.assertFalse((self.root / "called").exists())

    def test_arguments_refuse_before_reporting(self):
        result = self.invoke("--approve", "secret-value")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "RESULT=STOP\n")
        self.assertEqual(result.stderr, "STOP: f9:status accepts no arguments\n")
        self.assertNotIn("secret-value", result.stdout + result.stderr)
        self.assertFalse((self.root / "called").exists())

    def test_mise_task_refuses_without_script_and_never_invokes_providers(self):
        self.assertTrue(TASK["raw_args"])
        self.assertEqual(TASK["run"].count("tooling/native-ingress/f9-status.sh"), 3)
        result = subprocess.run(
            ["/usr/bin/bash", "-p", "-c", TASK["run"]],
            cwd=self.root,
            env=self.env,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "RESULT=STOP\n")
        self.assertFalse((self.root / "called").exists())

    def test_mise_task_delegates_to_helper_without_invoking_providers(self):
        helper = self.root / "tooling/native-ingress/f9-status.sh"
        helper.parent.mkdir(parents=True)
        helper.write_bytes(SCRIPT.read_bytes())
        result = subprocess.run(
            ["/usr/bin/bash", "-p", "-c", TASK["run"]],
            cwd=self.root,
            env=self.env,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, self.invoke().stdout)
        self.assertFalse((self.root / "called").exists())


if __name__ == "__main__":
    unittest.main()
