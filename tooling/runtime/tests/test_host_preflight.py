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
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from tooling.runtime.host_preflight import OUTPUT_BYTES, collect, identity, query


class HostPreflightTests(unittest.TestCase):
    @unittest.skipUnless(
        shutil.which("mise"), "requires installed mise for synthetic task e2e"
    )
    def test_actual_mise_task_emits_unprefixed_v2_json_with_only_synthetic_tool_queries(
        self,
    ):
        mise = shutil.which("mise")
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-mise-fake-tools-", dir="/tmp/opencode"
        ) as directory:
            root = Path(directory)
            for name, text in (
                ("mise", "synthetic mise version"),
                ("sbx", "synthetic sbx help"),
            ):
                executable = root / name
                executable.write_text(f"#!/bin/sh\nprintf '%s\\n' '{text}'\n")
                executable.chmod(0o700)
            env = dict(
                os.environ,
                PATH=f"{root}:/usr/bin:/bin",
                MISE_AUTO_INSTALL="false",
                MISE_TASK_RUN_AUTO_INSTALL="false",
                MISE_OFFLINE="true",
                MISE_DATA_DIR=str(root / "data"),
                MISE_CACHE_DIR=str(root / "cache"),
                MISE_STATE_DIR=str(root / "state"),
                MISE_GLOBAL_CONFIG_FILE=str(root / "absent-global.toml"),
                MISE_SYSTEM_CONFIG_FILE=str(root / "absent-system.toml"),
            )
            process = subprocess.run(
                [mise, "run", "host:preflight", "--confirm-host"],
                env=env,
                stdin=subprocess.DEVNULL,
                capture_output=True,
                timeout=10,
            )
            self.assertEqual(process.returncode, 0, process.stderr.decode())
            result = json.loads(process.stdout)
            self.assertEqual(result["version"], "chess-coach.host-preflight.v2")
            self.assertEqual(result["status"], "PASS_METADATA_ONLY")
            self.assertEqual(
                result["tools"]["mise"]["query"]["stdout"], "synthetic mise version\n"
            )
            self.assertEqual(
                result["tools"]["sbx"]["query"]["stdout"], "synthetic sbx help\n"
            )
            self.assertEqual(
                result["tools"]["sbx"]["query"]["command"],
                [str(root / "sbx"), "--help"],
            )
            for key in (
                "trainingReady",
                "trainingAuthorized",
                "provisioningAuthorized",
            ):
                self.assertFalse(result[key])

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
            self.assertTrue(result.stdout.startswith(b"usage:"), result.stdout.decode())
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
        self.assertEqual(result["version"], "chess-coach.host-preflight.v2")
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
            self.assertEqual(result["fileType"], "regular")
            self.assertEqual(result["hashStatus"], "FULL_SHA256")
            self.assertEqual(result["bytesRead"], len(target.read_bytes()))

    def test_large_regular_executable_reports_metadata_without_opening_or_hashing(self):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-host-large-", dir="/tmp/opencode"
        ) as root:
            path = Path(root) / "synthetic-large-tool"
            path.write_bytes(b"too-large")
            with (
                patch("tooling.runtime.host_preflight.EXECUTABLE_BYTES", 4),
                patch("tooling.runtime.host_preflight.os.open") as open_file,
            ):
                result = identity(str(path))
            open_file.assert_not_called()
            self.assertEqual(result["byteLength"], 9)
            self.assertEqual(result["fileType"], "regular")
            self.assertEqual(result["hashStatus"], "SKIPPED_SIZE_BOUND")
            self.assertEqual(result["hashLimitBytes"], 4)
            self.assertEqual(result["bytesRead"], 0)
            self.assertIsNone(result["sha256"])
            self.assertNotIn("error", result)

    def test_exact_hash_limit_remains_inclusive(self):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-host-bound-", dir="/tmp/opencode"
        ) as root:
            path = Path(root) / "tool"
            path.write_bytes(b"four")
            with patch("tooling.runtime.host_preflight.EXECUTABLE_BYTES", 4):
                result = identity(str(path))
            self.assertEqual(result["hashStatus"], "FULL_SHA256")
            self.assertEqual(result["bytesRead"], 4)
            self.assertEqual(result["sha256"], hashlib.sha256(b"four").hexdigest())

    def test_nonregular_executable_retains_type_and_size_without_opening_it(self):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-host-kind-", dir="/tmp/opencode"
        ) as root:
            path = Path(root) / "fifo"
            os.mkfifo(path)
            with patch("tooling.runtime.host_preflight.os.open") as open_file:
                result = identity(str(path))
            open_file.assert_not_called()
            self.assertEqual(result["fileType"], "non-regular")
            self.assertTrue(result["fileMode"].startswith("p"))
            self.assertEqual(result["byteLength"], 0)
            self.assertEqual(result["bytesRead"], 0)
            self.assertIn("EXECUTABLE_KIND", result["error"])

    def test_read_failure_retains_metadata_and_stops(self):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-host-read-", dir="/tmp/opencode"
        ) as root:
            path = Path(root) / "tool"
            path.write_bytes(b"preserved")
            with patch(
                "tooling.runtime.host_preflight.os.open",
                side_effect=PermissionError(13, "denied"),
            ):
                result = identity(str(path))
            self.assertEqual(result["byteLength"], 9)
            self.assertEqual(result["hashStatus"], "UNAVAILABLE")
            self.assertIn("errno=13", result["error"])
            self.assertIsNone(result["sha256"])

    def test_skipped_hash_does_not_block_help_or_collapse_selected_symlink_invocation(
        self,
    ):
        with (
            patch(
                "tooling.runtime.host_preflight.shutil.which",
                side_effect=["/fake/mise", "/fake/sbx"],
            ),
            patch(
                "tooling.runtime.host_preflight.identity",
                side_effect=lambda path: {
                    "selectedPath": path,
                    "resolvedPath": "/shared/dispatcher",
                    "sha256": None,
                    "hashStatus": "SKIPPED_SIZE_BOUND",
                    "bytesRead": 0,
                },
            ),
            patch(
                "tooling.runtime.host_preflight.query",
                return_value={"reaped": True, "forced": False},
            ) as run,
        ):
            result = collect()
        self.assertEqual(result["status"], "PASS_METADATA_ONLY")
        self.assertEqual(
            [call.args[0] for call in run.call_args_list],
            [["/fake/mise", "--version"], ["/fake/sbx", "--help"]],
        )
        self.assertIsNone(result["tools"]["sbx"]["sha256"])
        self.assertFalse(result["trainingReady"])

    def test_invalid_executable_kind_blocks_queries_without_discarding_metadata(self):
        with (
            patch(
                "tooling.runtime.host_preflight.shutil.which", return_value="/fake/mise"
            ),
            patch(
                "tooling.runtime.host_preflight.identity",
                return_value={
                    "fileType": "non-regular",
                    "byteLength": 0,
                    "error": "Host preflight: EXECUTABLE_KIND",
                },
            ),
            patch("tooling.runtime.host_preflight.query") as run,
        ):
            result = collect()
        self.assertEqual(result["status"], "BLOCKED")
        self.assertEqual(result["tools"]["mise"]["fileType"], "non-regular")
        run.assert_not_called()

    def test_actual_synthetic_symlink_dispatch_keeps_selected_command_name(self):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-host-dispatch-", dir="/tmp/opencode"
        ) as root:
            target = Path(root) / "dispatcher"
            target.write_text('#!/bin/sh\nprintf "%s\\n" "$0"\n')
            target.chmod(0o700)
            link = Path(root) / "sbx"
            link.symlink_to(target)
            tool = identity(str(link))
            result = query([tool["selectedPath"], "--help"])
            self.assertNotIn("error", result)
            self.assertEqual(result["stdout"], str(link) + "\n")

    def test_query_disables_mise_automatic_installation(self):
        result = query(
            [
                sys.executable,
                "-c",
                "import os; print(os.environ['MISE_AUTO_INSTALL'], os.environ['MISE_TASK_RUN_AUTO_INSTALL'])",
            ]
        )
        self.assertNotIn("error", result)
        self.assertEqual(result["stdout"], "false false\n")

    def test_changed_file_does_not_publish_a_complete_hash_or_read_beyond_the_initial_size(
        self,
    ):
        with tempfile.TemporaryDirectory(
            prefix="chess-coach-host-change-", dir="/tmp/opencode"
        ) as root:
            path = Path(root) / "tool"
            path.write_bytes(b"four")
            before = path.stat()
            after = SimpleNamespace(st_size=5, st_mtime_ns=before.st_mtime_ns)
            with (
                patch("tooling.runtime.host_preflight.EXECUTABLE_BYTES", 4),
                patch(
                    "tooling.runtime.host_preflight.os.fstat",
                    side_effect=[before, after],
                ),
            ):
                result = identity(str(path))
            self.assertEqual(result["bytesRead"], 4)
            self.assertEqual(result["hashStatus"], "INCOMPLETE_CHANGED")
            self.assertIn("EXECUTABLE_CHANGED", result["error"])
            self.assertIsNone(result["sha256"])

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
        self.assertTrue(task["raw"])
        self.assertNotIn("output", task)
        self.assertLessEqual(
            set(task), {"description", "raw_args", "raw", "quiet", "env", "run"}
        )
        self.assertEqual(task["run"], "python3 -I -B tooling/runtime/host_preflight.py")
        self.assertNotIn("depends", task)
        self.assertNotIn("sources", task)
        self.assertNotIn("outputs", task)
        self.assertEqual(json.loads(json.dumps(config))["tools"]["core:bun"], "1.4.0")
