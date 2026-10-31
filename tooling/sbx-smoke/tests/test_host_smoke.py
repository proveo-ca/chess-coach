import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).resolve().parents[1] / "host-smoke.sh"
FAKE = r"""#!/usr/bin/python3
import json
import os
from pathlib import Path
import signal
import sys

root = Path(os.environ["FAKE_SBX_HOME"])
mode = os.environ.get("FAKE_SBX_MODE", "success")
args = sys.argv[1:]
with (root / "calls").open("a") as output:
    output.write(json.dumps(args) + "\n")
state = root / "state"
if args == ["ls", "-q"]:
    count = root / "list-count"
    number = int(count.read_text()) + 1 if count.exists() else 1
    count.write_text(str(number))
    if ((mode == "list-fail-before" and number == 1)
            or (mode == "list-fail-after" and number == 2)
            or (mode == "list-fail-remove" and number == 3)):
        sys.exit(1)
    print("unrelated-sandbox")
    if mode == "preexisting" and number == 1:
        print((root / "preexisting").read_text())
    if state.exists():
        print(state.read_text())
elif args and args[0] == "create":
    assert len(args) == 14, args
    assert args[1] == "--name" and args[3:] == ["--pull", "never", "--skills", "off", "--deny-network", "**", "--cpus", "1", "--memory", "512m", "shell"], args
    state.write_text(args[2])
    if mode == "create-stopped-after-state":
        os.kill(os.getpid(), signal.SIGSTOP)
    if mode == "create-fail-after-state":
        sys.exit(1)
    if mode == "create-success-unlisted":
        state.unlink()
elif args and args[0] == "exec":
    assert args == ["exec", state.read_text(), "/bin/true"], args
    if mode == "exec-fail":
        sys.exit(1)
elif args and args[0] == "rm":
    assert args == ["rm", "--force", state.read_text()], args
    if mode == "remove-fail":
        sys.exit(1)
    if mode != "remove-still-listed":
        state.unlink()
else:
    raise SystemExit("unexpected sbx invocation")
"""


class SmokeTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(dir="/tmp/opencode")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.fake = self.root / "sbx"
        self.fake.write_text(FAKE)
        self.fake.chmod(0o755)

    def invoke(self, mode="success", extra=()):
        return subprocess.run(
            [
                "/usr/bin/bash",
                "--noprofile",
                "--norc",
                str(SCRIPT),
                "--confirm-dev-shared-daemon",
                "--sbx",
                str(self.fake),
                "--create-seconds",
                "1",
                *extra,
            ],
            env={
                **os.environ,
                "FAKE_SBX_HOME": str(self.root),
                "FAKE_SBX_MODE": mode,
                "HOME": str(self.root),
            },
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )

    def calls(self):
        path = self.root / "calls"
        return (
            [json.loads(line) for line in path.read_text().splitlines()]
            if path.exists()
            else []
        )

    def test_success_creates_executes_and_confirms_exact_name_removed(self):
        result = self.invoke()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("RESULT=DEV_SMOKE_ONLY\n", result.stdout)
        name = next(
            line.split("=", 1)[1]
            for line in result.stdout.splitlines()
            if line.startswith("ATTEMPT_NAME=")
        )
        self.assertRegex(name, r"^f9smoke-[0-9a-f]{24}$")
        self.assertIn(f"NAME_ABSENT_AFTER_RM={name}\n", result.stdout)
        self.assertEqual(
            self.calls(),
            [
                ["ls", "-q"],
                [
                    "create",
                    "--name",
                    name,
                    "--pull",
                    "never",
                    "--skills",
                    "off",
                    "--deny-network",
                    "**",
                    "--cpus",
                    "1",
                    "--memory",
                    "512m",
                    "shell",
                ],
                ["ls", "-q"],
                ["exec", name, "/bin/true"],
                ["rm", "--force", name],
                ["ls", "-q"],
            ],
        )
        self.assertFalse((self.root / "state").exists())

    def test_missing_confirmation_refuses_before_cli(self):
        result = subprocess.run(
            [
                "/usr/bin/bash",
                "--noprofile",
                "--norc",
                str(SCRIPT),
                "--sbx",
                str(self.fake),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.calls(), [])

    def test_preexisting_name_refuses_without_create(self):
        env = {
            **os.environ,
            "FAKE_SBX_HOME": str(self.root),
            "FAKE_SBX_MODE": "preexisting",
            "HOME": str(self.root),
        }
        command = [
            "/usr/bin/bash",
            "--noprofile",
            "--norc",
            str(SCRIPT),
            "--confirm-dev-shared-daemon",
            "--sbx",
            str(self.fake),
        ]
        process = subprocess.Popen(
            command, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        first = process.stdout.readline()
        self.assertTrue(first.startswith("ATTEMPT_NAME="), first)
        (self.root / "preexisting").write_text(first.split("=", 1)[1].strip())
        out, err = process.communicate(timeout=15)
        self.assertEqual(process.returncode, 2, err)
        self.assertIn("smoke name already exists", err)
        self.assertEqual(self.calls(), [["ls", "-q"]])
        self.assertNotIn("RESULT=DEV_SMOKE_ONLY", first + out)

    def test_failed_initial_listing_refuses_before_create(self):
        result = self.invoke("list-fail-before")
        self.assertEqual(result.returncode, 2)
        self.assertEqual(self.calls(), [["ls", "-q"]])

    def test_create_timeout_kills_stopped_child_and_never_removes(self):
        result = self.invoke("create-stopped-after-state")
        self.assertEqual(result.returncode, 2, result.stderr)
        self.assertIn("CREATE_UNCONFIRMED_NAME=", result.stderr)
        self.assertEqual([call[0] for call in self.calls()], ["ls", "create"])
        self.assertTrue((self.root / "state").exists())
        self.assertNotIn("RESULT=DEV_SMOKE_ONLY", result.stdout)

    def test_failed_create_after_partial_creation_never_removes(self):
        result = self.invoke("create-fail-after-state")
        self.assertEqual(result.returncode, 2)
        self.assertIn("CREATE_UNCONFIRMED_NAME=", result.stderr)
        self.assertEqual([call[0] for call in self.calls()], ["ls", "create"])
        self.assertTrue((self.root / "state").exists())

    def test_successful_create_without_exact_name_confirmation_never_removes(self):
        for mode in ("list-fail-after", "create-success-unlisted"):
            with self.subTest(mode=mode):
                (self.root / "list-count").unlink(missing_ok=True)
                (self.root / "calls").unlink(missing_ok=True)
                (self.root / "state").unlink(missing_ok=True)
                result = self.invoke(mode)
                self.assertEqual(result.returncode, 2)
                self.assertIn("OWNERSHIP_UNCONFIRMED_NAME=", result.stderr)
                self.assertEqual(
                    [call[0] for call in self.calls()], ["ls", "create", "ls"]
                )
                self.assertEqual(
                    (self.root / "state").exists(), mode == "list-fail-after"
                )

    def test_failed_exec_still_removes_confirmed_name(self):
        result = self.invoke("exec-fail")
        self.assertEqual(result.returncode, 2)
        self.assertIn("EXEC_FAILED_NAME=", result.stderr)
        self.assertIn("NAME_ABSENT_AFTER_RM=", result.stdout)
        self.assertEqual(
            [call[0] for call in self.calls()],
            ["ls", "create", "ls", "exec", "rm", "ls"],
        )
        self.assertFalse((self.root / "state").exists())
        self.assertNotIn("RESULT=DEV_SMOKE_ONLY", result.stdout)

    def test_failed_removal_is_not_reported_as_success(self):
        result = self.invoke("remove-fail")
        self.assertEqual(result.returncode, 2)
        self.assertIn("REMOVE_UNCONFIRMED_NAME=", result.stderr)
        self.assertTrue((self.root / "state").exists())
        self.assertEqual(
            [call[0] for call in self.calls()], ["ls", "create", "ls", "exec", "rm"]
        )

    def test_removal_success_without_absence_confirmation_is_uncertain(self):
        for mode in ("remove-still-listed", "list-fail-remove"):
            with self.subTest(mode=mode):
                (self.root / "list-count").unlink(missing_ok=True)
                (self.root / "calls").unlink(missing_ok=True)
                (self.root / "state").unlink(missing_ok=True)
                result = self.invoke(mode)
                self.assertEqual(result.returncode, 2)
                self.assertIn("REMOVE_UNCONFIRMED_NAME=", result.stderr)
                self.assertNotIn("RESULT=DEV_SMOKE_ONLY", result.stdout)


if __name__ == "__main__":
    unittest.main()
