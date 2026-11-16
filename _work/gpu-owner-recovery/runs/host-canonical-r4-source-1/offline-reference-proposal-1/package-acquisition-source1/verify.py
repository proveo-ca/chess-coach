# SPEC: _spec/runtime-protocol.puml
import ast
import hashlib
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import time


SOURCE = Path(__file__).absolute().parent
ROOT = SOURCE.parents[5]
D_REL = Path(
    "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1"
)
CODE_FILES = ("capture.py", "test_capture.py", "verify.py")
EXPECTED = {
    "request": "2eb3c9727f788f9c95f0f2650ee89bbd94a5eb5ed289db67d91226e978140b70",
    "plan": "8ecfce5156322da42fb852cd071a6091b96187e19a88226bec68295936505f6c",
    "approval": "62af17fc6199b5537c3488c10680b9269baf170a05a322facfdfad3737fea945",
    "lock": "1d05ed3d8de5a94873f26a2fb51b88c080704d2e90bf942f9f0bb2ce75a504e0",
}
STREAM_CAP = 65536


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read_bounded(path, cap):
    with path.open("rb") as source:
        data = source.read(cap + 1)
    if len(data) > cap:
        raise RuntimeError("verification-input-cap")
    return data


def hashes():
    return {
        name: digest(read_bounded(SOURCE / name, 256 * 1024)) for name in CODE_FILES
    }


def bindings():
    paths = {
        "request": D_REL / "package-acquisition-proposal-1/request.json",
        "plan": D_REL / "package-acquisition-proposal-1/plan.json",
        "approval": D_REL / "package-acquisition-proposal-1/approval1.json",
        "lock": D_REL / "local-inputs-1/inputs/reference/pnpm-lock.yaml",
    }
    result = {
        name: digest(read_bounded(ROOT / path, 8 * 1024 * 1024))
        for name, path in paths.items()
    }
    if result != EXPECTED:
        raise RuntimeError("verification-document-pin-drift")
    return result


def exclusive(path, data, cap=65536):
    if len(data) > cap:
        raise RuntimeError("verification-output-cap")
    with path.open("xb") as output:
        output.write(data)
        output.flush()
        os.fsync(output.fileno())


def json_file(path, value):
    data = (json.dumps(value, sort_keys=True, indent=2, allow_nan=False) + "\n").encode(
        "utf-8"
    )
    exclusive(path, data)
    return digest(data)


def static_checks():
    checks = []
    for name in CODE_FILES:
        data = read_bounded(SOURCE / name, 256 * 1024)
        tree = ast.parse(data, filename=name)
        checks.append(name + ":AST_PARSE")
        for node in ast.walk(tree):
            if not isinstance(node, ast.Call):
                continue
            target = node.func
            called = (
                target.id
                if isinstance(target, ast.Name)
                else target.attr
                if isinstance(target, ast.Attribute)
                else ""
            )
            if called in (
                "eval",
                "exec",
                "compile",
                "extract",
                "extractall",
                "system",
                "posix_spawn",
            ):
                raise RuntimeError("forbidden-source-call:" + name + ":" + called)
            if name == "test_capture.py" and called in (
                "Popen",
                "run",
                "execute_approved",
                "worker_main",
                "real_open_https",
                "HTTPSExchange",
                "prepare_paths",
                "owned_partials",
                "bootstrap",
            ):
                if (
                    called != "run"
                    or not isinstance(target, ast.Attribute)
                    or not isinstance(target.value, ast.Call)
                ):
                    raise RuntimeError("forbidden-test-operation:" + called)
        if name == "capture.py":
            imported = {
                alias.name.split(".")[0]
                for node in ast.walk(tree)
                if isinstance(node, ast.Import)
                for alias in node.names
            }
            if not imported <= set(sys.stdlib_module_names):
                raise RuntimeError("non-stdlib-import")
            functions = {
                node.name: node
                for node in ast.walk(tree)
                if isinstance(node, ast.FunctionDef)
            }
            pure = functions["download_archive"]
            kw = dict(
                zip(
                    [argument.arg for argument in pure.args.kwonlyargs],
                    pure.args.kw_defaults,
                )
            )
            if "open_https" not in kw or kw["open_https"] is not None:
                raise RuntimeError("transport-injection-must-be-required")
            popens = [
                node
                for node in ast.walk(tree)
                if isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr == "Popen"
            ]
            if len(popens) != 1:
                raise RuntimeError("one-worker-spawn-required")
            keywords = {
                keyword.arg: ast.literal_eval(keyword.value)
                for keyword in popens[0].keywords
                if keyword.arg in ("shell", "close_fds", "start_new_session")
            }
            if keywords != {
                "shell": False,
                "close_fds": True,
                "start_new_session": True,
            }:
                raise RuntimeError("worker-spawn-flags")
            checks.extend(
                [
                    "STDLIB_IMPORTS",
                    "REQUIRED_MOCK_FACTORY",
                    "ONE_ISOLATED_WORKER_SPAWN",
                    "NO_EVAL_OR_TAR_EXTRACTION_TO_FILESYSTEM",
                ]
            )
    return checks


def bounded_tests(fixtures):
    process = subprocess.Popen(
        [sys.executable, "-I", "-S", "-B", str(SOURCE / "test_capture.py")],
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        shell=False,
        close_fds=True,
        start_new_session=True,
        cwd=ROOT,
        bufsize=0,
        env={"CAPTURE_FIXTURES": str(fixtures), "LC_ALL": "C", "LANG": "C"},
    )
    streams = {
        process.stdout.fileno(): bytearray(),
        process.stderr.fileno(): bytearray(),
    }
    stdout_fd, stderr_fd = process.stdout.fileno(), process.stderr.fileno()
    active = set(streams)
    for fd in active:
        os.set_blocking(fd, False)
    deadline = time.monotonic() + 60
    failure = None
    try:
        while active:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise RuntimeError("unittest-deadline")
            readable, _, _ = select.select(list(active), [], [], min(remaining, 0.1))
            for fd in readable:
                room = STREAM_CAP - len(streams[fd])
                chunk = os.read(fd, min(8192, room + 1))
                if not chunk:
                    active.remove(fd)
                    continue
                streams[fd].extend(chunk[:room])
                if len(chunk) > room:
                    raise RuntimeError("unittest-stream-cap")
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise RuntimeError("unittest-reap-deadline")
        process.wait(timeout=remaining)
    except (Exception, KeyboardInterrupt) as error:
        failure = type(error).__name__ + ":" + str(error)[:160]
    finally:
        if process.poll() is None:
            for sig, limit in ((signal.SIGTERM, 1), (signal.SIGKILL, 3)):
                try:
                    os.killpg(process.pid, sig)
                except ProcessLookupError:
                    pass
                try:
                    process.wait(timeout=limit)
                    break
                except subprocess.TimeoutExpired:
                    continue
        reaped = process.poll() is not None
        process.stdout.close()
        process.stderr.close()
    return (
        bytes(streams[stdout_fd]),
        bytes(streams[stderr_fd]),
        process.returncode,
        reaped,
        failure,
    )


def reserve_label():
    if len(sys.argv) > 1:
        if len(sys.argv) != 3 or sys.argv[1] != "--label":
            raise RuntimeError("use-only-optional-label")
        labels = [sys.argv[2]]
    else:
        labels = ["verification-" + str(index) for index in range(1, 100)]
    for label in labels:
        suffix = label.removeprefix("verification-")
        if not (
            label.startswith("verification-")
            and suffix.isascii()
            and suffix.isdigit()
            and str(int(suffix)) == suffix
            and 1 <= int(suffix) <= 99
        ):
            raise RuntimeError("verification-label-range")
        path = SOURCE / label
        try:
            path.mkdir(mode=0o700)
            return path
        except FileExistsError:
            if len(sys.argv) > 1:
                raise
    raise RuntimeError("verification-labels-exhausted")


def main():
    output = reserve_label()
    fixtures = output / "fixtures"
    fixtures.mkdir(mode=0o700)
    receipt = {
        "status": "FAIL_MOCK_ONLY",
        "scope": "STDLIB_AST_AND_SYNTHETIC_UNIT_PROTOCOL_TESTS",
        "actualAcquisitionInvoked": False,
        "actualWorkerInvoked": False,
        "productionPathsTouched": False,
        "unitTests": 0,
        "negativeCases": 0,
        "sourceHashes": {},
        "bindings": {},
        "staticChecks": [],
        "unitProcessReaped": False,
        "networkTransport": "IN_MEMORY_SYNTHETIC_ONLY",
        "actualNativeInstallBuildGitMutation": False,
        "binaryFixturesExcludedBySourceGitignore": True,
    }
    stdout = b""
    stderr = b""
    try:
        receipt["sourceHashes"] = hashes()
        receipt["bindings"] = bindings()
        receipt["sourceManifestSha256"] = json_file(
            output / "source-manifest.json",
            {"sourceHashes": receipt["sourceHashes"], "bindings": receipt["bindings"]},
        )
        receipt["staticChecks"] = static_checks()
        stdout, stderr, code, reaped, failure = bounded_tests(fixtures)
        receipt.update(
            {"unitExitCode": code, "unitProcessReaped": reaped, "unitFailure": failure}
        )
        lines = [
            line
            for line in stdout.decode("utf-8", "strict").splitlines()
            if line.startswith("MOCK_TEST_SUMMARY ")
        ]
        if len(lines) != 1:
            raise RuntimeError("missing-unique-unit-summary")
        summary = json.loads(lines[0].removeprefix("MOCK_TEST_SUMMARY "))
        receipt["unitSummary"] = summary
        receipt["unitTests"] = summary["unitTests"]
        receipt["negativeCases"] = summary["negativeCases"]
        if (
            code != 0
            or not reaped
            or failure is not None
            or summary["failures"]
            or summary["errors"]
            or summary["guardViolations"]
            or summary["unitTests"] <= 0
            or summary["negativeCases"] <= 0
        ):
            raise RuntimeError("mock-unit-verification-failed")
        if hashes() != receipt["sourceHashes"] or bindings() != receipt["bindings"]:
            raise RuntimeError("verification-binding-drift")
        receipt["status"] = "PASS_MOCK_ONLY"
    except (Exception, KeyboardInterrupt) as error:
        receipt["failure"] = type(error).__name__ + ":" + str(error)[:256]
    exclusive(output / "unittest.stdout", stdout)
    exclusive(output / "unittest.stderr", stderr)
    receipt["streams"] = {
        "unittest.stdout": {"bytes": len(stdout), "sha256": digest(stdout)},
        "unittest.stderr": {"bytes": len(stderr), "sha256": digest(stderr)},
    }
    json_file(output / "receipt.json", receipt)
    print(
        json.dumps(
            {
                "status": receipt["status"],
                "receipt": str((output / "receipt.json").relative_to(ROOT)),
                "unitTests": receipt["unitTests"],
                "negativeCases": receipt["negativeCases"],
            }
        )
    )
    return 0 if receipt["status"] == "PASS_MOCK_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
