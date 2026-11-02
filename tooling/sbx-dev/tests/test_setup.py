import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
FAKE = """#!/usr/bin/python3
import json
import os
from pathlib import Path
import sys

root = Path(os.environ['FAKE_SBX_HOME'])
args = sys.argv[1:]
with (root / 'calls').open('a') as output:
    output.write(json.dumps(args) + '\\n')
mode = os.environ.get('FAKE_MODE', '')
state = root / 'name'
if args == ['ls', '-q']:
    if state.exists() and mode != 'unlisted':
        print(state.read_text())
elif args and args[0] == 'create':
    state.write_text(args[2])
    if mode == 'create-fail':
        sys.exit(1)
elif args and args[0] == 'cp':
    if mode == 'copy-fail':
        sys.exit(1)
elif args and args[0] == 'exec':
    if mode == 'exec-fail':
        sys.exit(1)
else:
    sys.exit('unexpected sbx invocation')
"""


class SetupTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(dir="/tmp/opencode")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.fake = self.root / "sbx"
        self.fake.write_text(FAKE)
        self.fake.chmod(0o755)
        self.archive = self.root / "tools.tar"
        with tarfile.open(self.archive, "w") as bundle:
            for name in ("bin/rustc", "bin/cargo"):
                payload = b"offline fixture"
                item = tarfile.TarInfo(name)
                item.size = len(payload)
                item.mode = 0o755
                bundle.addfile(item, io.BytesIO(payload))
        import hashlib

        self.digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()

    def invoke(self, script, *args, mode=""):
        return subprocess.run(
            ["/usr/bin/bash", "--noprofile", "--norc", str(ROOT / script), *args],
            env={**os.environ, "FAKE_SBX_HOME": str(self.root), "FAKE_MODE": mode},
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

    def create(self, mode=""):
        return self.invoke("create.sh", "--sbx", str(self.fake), mode=mode)

    def seed(self, name=None, digest=None, mode=""):
        return self.invoke(
            "seed.sh",
            "--sbx",
            str(self.fake),
            "--name",
            name or (self.root / "name").read_text(),
            "--bundle",
            str(self.archive),
            "--sha256",
            digest or self.digest,
            mode=mode,
        )

    def test_create_exact_mountless_command_and_retention(self):
        result = self.create()
        self.assertEqual(result.returncode, 0, result.stderr)
        name = (self.root / "name").read_text()
        self.assertRegex(name, r"^devrust-[0-9a-f]{24}$")
        self.assertIn(f"DEV_CREATED_NAME={name}", result.stdout)
        self.assertEqual(
            self.calls(),
            [
                ["ls", "-q"],
                [
                    "create",
                    "--name",
                    name,
                    "--template",
                    "docker.io/docker/sandbox-templates:shell-docker",
                    "--pull",
                    "never",
                    "--skills",
                    "off",
                    "--deny-network",
                    "**",
                    "--cpus",
                    "2",
                    "--memory",
                    "4g",
                    "shell",
                ],
                ["ls", "-q"],
            ],
        )

    def test_ambiguous_create_does_not_retry_or_remove(self):
        result = self.create(mode="create-fail")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("CREATE_UNCONFIRMED_NAME=", result.stderr)
        self.assertEqual(len(self.calls()), 2)

    def test_unlisted_create_does_not_remove(self):
        result = self.create(mode="unlisted")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("OWNERSHIP_UNCONFIRMED_NAME=", result.stderr)
        self.assertEqual(len(self.calls()), 3)

    def test_seed_checks_digest_then_copies_only_bundle_and_entrypoint(self):
        self.create()
        name = (self.root / "name").read_text()
        (self.root / "calls").unlink()
        result = self.seed()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("RESULT=DEV_ONLY_SEEDED", result.stdout)
        self.assertEqual(
            self.calls(),
            [
                ["ls", "-q"],
                [
                    "cp",
                    str(self.archive),
                    f"{name}:/home/agent/workspace/devrust-tools.tar",
                ],
                [
                    "cp",
                    str(ROOT / "install-rust.sh"),
                    f"{name}:/home/agent/workspace/install-rust.sh",
                ],
                [
                    "exec",
                    name,
                    "/bin/sh",
                    "/home/agent/workspace/install-rust.sh",
                    self.digest,
                ],
            ],
        )

    def test_bad_digest_fails_before_sbx(self):
        self.create()
        (self.root / "calls").unlink()
        result = self.seed(digest="0" * 64)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.calls(), [])

    def test_missing_name_refuses_before_copy(self):
        self.create()
        (self.root / "calls").unlink()
        result = self.seed(name="devrust-" + "f" * 24)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.calls(), [["ls", "-q"]])

    def test_unsafe_archive_fails_before_sbx(self):
        with tarfile.open(self.archive, "w") as bundle:
            item = tarfile.TarInfo("../../host")
            item.size = 1
            bundle.addfile(item, io.BytesIO(b"x"))
        import hashlib

        self.digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        self.create()
        (self.root / "calls").unlink()
        result = self.seed()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.calls(), [])

    def test_link_archive_fails_before_sbx(self):
        with tarfile.open(self.archive, "w") as bundle:
            for name in ("bin/rustc", "bin/cargo"):
                item = tarfile.TarInfo(name)
                item.type = tarfile.SYMTYPE
                item.linkname = "/home/agent/.ssh"
                bundle.addfile(item)
        import hashlib

        self.digest = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        self.create()
        (self.root / "calls").unlink()
        result = self.seed()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.calls(), [])

    def test_failed_copy_or_exec_never_removes(self):
        self.create()
        for mode, expected in (("copy-fail", 2), ("exec-fail", 4)):
            with self.subTest(mode=mode):
                (self.root / "calls").unlink()
                result = self.seed(mode=mode)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(len(self.calls()), expected)
                self.assertFalse(any(call[0] == "rm" for call in self.calls()))


if __name__ == "__main__":
    unittest.main()
