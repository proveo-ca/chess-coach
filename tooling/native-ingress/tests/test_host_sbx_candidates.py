import json
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
GUARD = ROOT / "host-sbx-guard-candidate.sh"
PROVENANCE = ROOT / "host-sbx-provenance-candidate.py"
READINESS = ROOT / "host-sbx-readiness.sh"
INVENTORY = ROOT / "host-sbx-boundary-inventory.sh"


class OfflineCandidateTest(unittest.TestCase):
    def test_boundary_inventory_reports_only_candidates_and_never_calls_providers(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            for name in ("sbx", "systemctl", "sudo", "getent", "findmnt"):
                fake = base / name
                fake.write_text(f"#!/bin/sh\nprintf called >> '{base / 'called'}'\n")
                fake.chmod(0o755)
            env = {**os.environ, "PATH": str(base)}
            result = subprocess.run(
                ["/usr/bin/bash", "--noprofile", "--norc", str(INVENTORY)],
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stderr, "")
            lines = result.stdout.splitlines()
            self.assertEqual(lines[0], "F9_HOST_BOUNDARY_INVENTORY_V1")
            self.assertEqual(lines[-2:], ["INVENTORY=COMPLETE", "BOUNDARY=UNVERIFIED"])
            for label, values in (
                ("UNIT_FILE", ("FILE_CANDIDATE", "UNSEEN")),
                ("SLICE_FILE", ("FILE_CANDIDATE", "UNSEEN")),
                ("HOME_DIR", ("DIRECTORY_CANDIDATE", "UNSEEN")),
                ("RUNTIME_DIR", ("DIRECTORY_CANDIDATE", "UNSEEN")),
            ):
                self.assertIn(lines.pop(1), [f"{label}={value}" for value in values])
            self.assertEqual(
                lines,
                [
                    "F9_HOST_BOUNDARY_INVENTORY_V1",
                    "INVENTORY=COMPLETE",
                    "BOUNDARY=UNVERIFIED",
                ],
            )
            self.assertFalse((base / "called").exists())

            refused = subprocess.run(
                [
                    "/usr/bin/bash",
                    "--noprofile",
                    "--norc",
                    str(INVENTORY),
                    "unexpected",
                ],
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(refused.returncode, 2)
            self.assertEqual(refused.stdout, "")
            self.assertIn("STOP:", refused.stderr)
            self.assertFalse((base / "called").exists())

    def test_readiness_reports_stop_without_invoking_sbx(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            fake = base / "sbx"
            fake.write_text(f"#!/bin/sh\nprintf called >> '{base / 'called'}'\n")
            fake.chmod(0o755)
            result = subprocess.run(
                ["bash", str(READINESS)],
                env={
                    **os.environ,
                    "PATH": f"{base}:{os.environ.get('PATH', '')}",
                    "F9_DEDICATED_USER": "candidate",
                    "F9_DEDICATED_UNIT": "candidate.service",
                    "F9_INPUTS": str(base),
                    "F9_EVIDENCE": str(base),
                    "F9_HOST_GUARD": str(fake),
                    "F9_PROVENANCE_VERIFIER": str(fake),
                },
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 2)
            self.assertIn("RESULT=STOP\n", result.stdout)
            self.assertIn("SBX=PATH_CANDIDATE\n", result.stdout)
            self.assertNotIn("PASS", result.stdout + result.stderr)
            self.assertFalse((base / "called").exists())

    def test_guard_refuses_runner_request_before_any_provider(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            bin_dir = base / "bin"
            bin_dir.mkdir()
            for name in ("sbx", "preflight", "verifier"):
                fake = bin_dir / name
                fake.write_text(f"#!/bin/sh\nprintf called >> '{base / 'called'}'\n")
                fake.chmod(0o755)
            result = subprocess.run(
                [
                    "bash",
                    str(GUARD),
                    "--inputs",
                    str(base),
                    "--evidence",
                    str(base / "evidence"),
                    "--preflight",
                    str(bin_dir / "preflight"),
                    "--verifier",
                    str(bin_dir / "verifier"),
                    "--patch",
                    str(base / "patch"),
                    "--filter",
                    "exec.exec_test_original_custody*",
                ],
                env={**os.environ, "PATH": f"{bin_dir}:{os.environ.get('PATH', '')}"},
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(result.returncode, 2)
            self.assertIn("STOP:", result.stderr)
            self.assertNotIn("PASS", result.stdout + result.stderr)
            self.assertFalse((base / "called").exists())

    def test_candidate_pins_never_authenticate(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            record = base / "record.json"
            for value in (
                {
                    "schema": "f9-host-sbx-candidate-v0",
                    "pins": {
                        name: "a" * 64
                        for name in ("linux", "llvm", "patch", "tools", "zig")
                    },
                },
                {"schema": "f9-host-sbx-candidate-v0", "pins": {}},
            ):
                record.write_text(json.dumps(value))
                result = subprocess.run(
                    [
                        "python3",
                        str(PROVENANCE),
                        "--inputs",
                        str(base),
                        "--trust-record",
                        str(record),
                        "--expected-record-sha256",
                        hashlib.sha256(record.read_bytes()).hexdigest(),
                        "--offline-only",
                    ],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 2)
                self.assertIn("STOP:", result.stderr)
                self.assertNotIn("PASS", result.stdout + result.stderr)

    def test_pinned_bytes_offline_success_and_tamper_refusals(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            inputs = base / "inputs"
            inputs.mkdir()
            (inputs / "source.bin").write_bytes(b"source fixture")
            (inputs / "tool.bin").write_bytes(b"tool fixture")
            record = base / "record.json"
            entries = {
                name: {
                    "sha256": hashlib.sha256((inputs / name).read_bytes()).hexdigest(),
                    "bytes": (inputs / name).stat().st_size,
                }
                for name in ("source.bin", "tool.bin")
            }
            record.write_text(
                json.dumps({"schema": "f9-offline-bytes-v1", "inputs": entries})
            )
            pin = hashlib.sha256(record.read_bytes()).hexdigest()
            poison = base / "bin"
            poison.mkdir()
            for name in ("sbx", "preflight", "verifier"):
                fake = poison / name
                fake.write_text(f"#!/bin/sh\nprintf called >> '{base / 'called'}'\n")
                fake.chmod(0o755)
            env = {**os.environ, "PATH": f"{poison}:{os.environ.get('PATH', '')}"}

            def invoke(command, source=inputs, anchor=pin):
                return subprocess.run(
                    command
                    + [
                        "--inputs",
                        str(source),
                        "--trust-record",
                        str(record),
                        "--expected-record-sha256",
                        anchor,
                    ],
                    env=env,
                    capture_output=True,
                    text=True,
                    check=False,
                )

            verifier = ["python3", str(PROVENANCE), "--offline-only"]
            guard = ["bash", str(GUARD), "--offline-check"]
            for command in (verifier, guard):
                result = invoke(command)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, "OFFLINE_PINNED_BYTES_ONLY\n")
            self.assertFalse((base / "called").exists())

            runner = subprocess.run(
                [
                    "bash",
                    str(GUARD),
                    "--inputs",
                    str(inputs),
                    "--evidence",
                    str(base),
                    "--preflight",
                    str(poison / "preflight"),
                    "--verifier",
                    str(poison / "verifier"),
                    "--patch",
                    str(base / "patch"),
                    "--filter",
                    "exec.exec_test_original_custody*",
                ],
                env=env,
                capture_output=True,
                text=True,
                check=False,
            )
            self.assertEqual(runner.returncode, 2)
            self.assertNotIn("OFFLINE_PINNED_BYTES_ONLY", runner.stdout + runner.stderr)
            self.assertFalse((base / "called").exists())

            (inputs / "source.bin").write_bytes(b"source fixturE")
            self.assertEqual(invoke(guard).returncode, 2)
            (inputs / "source.bin").write_bytes(b"source fixture")
            (inputs / "extra").write_bytes(b"unlisted")
            self.assertEqual(invoke(verifier).returncode, 2)
            (inputs / "extra").unlink()
            (inputs / "tool.bin").unlink()
            (inputs / "tool.bin").symlink_to(base / "record.json")
            self.assertEqual(invoke(verifier).returncode, 2)
            (inputs / "tool.bin").unlink()
            (inputs / "tool.bin").write_bytes(b"tool fixture")
            alias = base / "alias"
            alias.symlink_to(inputs, target_is_directory=True)
            self.assertEqual(invoke(verifier, source=alias).returncode, 2)
            self.assertEqual(invoke(verifier, anchor="0" * 64).returncode, 2)
            record.write_text(
                '{"schema":"f9-offline-bytes-v1","inputs":{},"inputs":{}}'
            )
            duplicate_pin = hashlib.sha256(record.read_bytes()).hexdigest()
            self.assertEqual(invoke(verifier, anchor=duplicate_pin).returncode, 2)
            record.write_text(
                json.dumps(
                    {
                        "schema": "f9-offline-bytes-v1",
                        "inputs": entries,
                        "allow_vm": True,
                    }
                )
            )
            extra_pin = hashlib.sha256(record.read_bytes()).hexdigest()
            self.assertEqual(invoke(verifier, anchor=extra_pin).returncode, 2)
            self.assertFalse((base / "called").exists())


if __name__ == "__main__":
    unittest.main()
