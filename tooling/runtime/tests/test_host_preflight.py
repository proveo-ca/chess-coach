# SPEC: _spec/host-entrypoint.puml
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import tomllib
import unittest
from unittest.mock import patch

from tooling.runtime.host_preflight import OUTPUT_BYTES, collect, identity, query


class HostPreflightTests(unittest.TestCase):
    @unittest.skipUnless(
        shutil.which("mise"), "requires installed mise for task parser fixture"
    )
    def test_mise_parser_runs_without_seeded_bun_or_rust_and_does_not_install_them(
        self,
    ):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-mise-empty-", dir="/tmp/opencode"
        ) as directory:
            root = Path(directory)
            env = dict(
                os.environ,
                MISE_AUTO_INSTALL="false",
                MISE_TASK_RUN_AUTO_INSTALL="false",
                MISE_OFFLINE="true",
                MISE_DATA_DIR=str(root / "data"),
                MISE_CACHE_DIR=str(root / "cache"),
                MISE_STATE_DIR=str(root / "state"),
                MISE_GLOBAL_CONFIG_FILE=str(root / "absent-global.toml"),
                MISE_SYSTEM_CONFIG_FILE=str(root / "absent-system.toml"),
            )
            result = subprocess.run(
                [shutil.which("mise"), "run", "host:preflight", "--help"],
                env=env,
                stdin=subprocess.DEVNULL,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(result.returncode, 0, result.stderr.decode())
            self.assertIn(b"--confirm-host", result.stdout)
            self.assertFalse(any((root / "data" / "installs").glob("*")))

    def test_only_fixed_local_identity_and_help_commands_are_available(self):
        with (
            patch(
                "tooling.runtime.host_preflight.shutil.which",
                side_effect=["/fake/mise", "/fake/sbx"],
            ),
            patch(
                "tooling.runtime.host_preflight.identity",
                side_effect=lambda path: {"resolvedPath": path},
            ),
            patch(
                "tooling.runtime.host_preflight.query",
                return_value={"reaped": True, "forced": False},
            ) as run,
        ):
            result = collect()
        self.assertEqual(
            [call.args[0] for call in run.call_args_list],
            [["/fake/mise", "--version"], ["/fake/sbx", "--help"]],
        )
        self.assertEqual(result["executionRealm"], "OPERATOR_ASSERTED_HOST_UNQUALIFIED")
        for key in ("trainingReady", "trainingAuthorized", "provisioningAuthorized"):
            self.assertFalse(result[key])

    def test_missing_tool_is_not_installed_or_replaced(self):
        with (
            patch("tooling.runtime.host_preflight.shutil.which", return_value=None),
            patch("tooling.runtime.host_preflight.query") as run,
        ):
            result = collect()
        run.assert_not_called()
        self.assertEqual(result["status"], "BLOCKED")

    def test_failed_or_forced_query_stops_before_the_next_tool(self):
        for receipt in (
            {"error": "failure", "reaped": True, "forced": False},
            {"reaped": True, "forced": True},
        ):
            with (
                patch(
                    "tooling.runtime.host_preflight.shutil.which",
                    return_value="/fake/mise",
                ) as select,
                patch(
                    "tooling.runtime.host_preflight.identity",
                    return_value={"resolvedPath": "/fake/mise"},
                ),
                patch(
                    "tooling.runtime.host_preflight.query", return_value=receipt
                ) as run,
            ):
                result = collect()
            self.assertEqual(result["status"], "BLOCKED")
            self.assertEqual(select.call_count, 1)
            self.assertEqual(run.call_count, 1)

    def test_selected_bytes_and_symlink_target_are_recorded(self):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-host-identity-", dir="/tmp/opencode"
        ) as root:
            target = Path(root) / "tool"
            target.write_bytes(b"synthetic-executable")
            link = Path(root) / "selected"
            link.symlink_to(target)
            result = identity(str(link))
            self.assertEqual(result["resolvedPath"], str(target))
            self.assertEqual(
                result["sha256"], hashlib.sha256(target.read_bytes()).hexdigest()
            )
            self.assertEqual(result["byteLength"], len(target.read_bytes()))

    def test_actual_synthetic_help_child_closes_and_reaps(self):
        result = query([sys.executable, "-c", "print('synthetic help')"])
        self.assertNotIn("error", result)
        self.assertTrue(result["reaped"])
        self.assertFalse(result["forced"])
        self.assertEqual(result["stdout"], "synthetic help\n")

    def test_output_exhaustion_retains_prefix_and_stops_without_retry(self):
        result = query(
            [
                sys.executable,
                "-c",
                "import os; os.write(1, b'x' * 200000); os.write(2, b'e' * 200000)",
            ]
        )
        self.assertIn("COMMAND_BYTE_BOUND", result["error"])
        self.assertEqual(len(result["stdout"]) + len(result["stderr"]), OUTPUT_BYTES)
        self.assertTrue(result["reaped"])

    def test_timeout_kills_owned_child_and_retains_failure(self):
        result = query(
            [sys.executable, "-c", "import time; time.sleep(10)"], timeout_seconds=0.05
        )
        self.assertIn("COMMAND_DEADLINE", result["error"])
        self.assertTrue(result["forced"])
        self.assertTrue(result["reaped"])

    def test_nonzero_help_is_failure_not_a_provisioning_fallback(self):
        result = query(
            [sys.executable, "-c", "import sys; print('unsupported'); sys.exit(2)"]
        )
        self.assertEqual(result["exitCode"], 2)
        self.assertIn("COMMAND_EXIT", result["error"])
        self.assertEqual(result["stdout"], "unsupported\n")

    def test_host_assertion_is_required_before_any_probe(self):
        result = subprocess.run(
            [sys.executable, "-I", "tooling/runtime/host_preflight.py"],
            capture_output=True,
            timeout=5,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertIn(b"--confirm-host", result.stderr)
        self.assertEqual(result.stdout, b"")

    def test_mise_task_forwards_arguments_without_install_or_operational_dependencies(
        self,
    ):
        config = tomllib.loads(Path("mise.toml").read_text())
        self.assertFalse(config["settings"]["auto_install"])
        self.assertFalse(config["settings"]["task"]["run_auto_install"])
        task = config["tasks"]["host:preflight"]
        self.assertTrue(task["raw_args"])
        self.assertEqual(task["run"], "python3 -I -B tooling/runtime/host_preflight.py")
        self.assertNotIn("depends", task)
        self.assertNotIn("sources", task)
        self.assertNotIn("outputs", task)
        self.assertEqual(json.loads(json.dumps(config))["tools"]["core:bun"], "1.4.0")
