# SPEC: _spec/host-entrypoint.puml
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import time


OUTPUT_BYTES = 65536
EXECUTABLE_BYTES = 128 * 1024 * 1024
SBX_HELP = ("version", "create", "exec", "stop", "rm", "cp")


def identity(path: str) -> dict:
    selected = Path(path).absolute()
    resolved = selected.resolve(strict=True)

    def metadata(info: os.stat_result) -> dict:
        regular = stat.S_ISREG(info.st_mode)
        result = {
            "selectedPath": str(selected),
            "resolvedPath": str(resolved),
            "fileType": "regular" if regular else "non-regular",
            "fileMode": stat.filemode(info.st_mode),
            "byteLength": info.st_size,
            "device": info.st_dev,
            "inode": info.st_ino,
            "sha256": None,
            "bytesRead": 0,
            "hashLimitBytes": EXECUTABLE_BYTES,
            "hashStatus": "PENDING",
        }
        if not regular:
            result.update(
                error="Host preflight: EXECUTABLE_KIND", hashStatus="REJECTED_KIND"
            )
        elif info.st_size > EXECUTABLE_BYTES:
            result["hashStatus"] = "SKIPPED_SIZE_BOUND"
        return result

    result = metadata(resolved.stat())
    if result["hashStatus"] != "PENDING":
        return result
    try:
        fd = os.open(resolved, os.O_RDONLY | os.O_NONBLOCK | os.O_NOFOLLOW)
        with os.fdopen(fd, "rb", buffering=0) as handle:
            before = os.fstat(handle.fileno())
            result = metadata(before)
            if result["hashStatus"] != "PENDING":
                return result
            digest = hashlib.sha256()
            remaining = before.st_size
            while remaining:
                data = handle.read(min(65536, remaining))
                if not data:
                    break
                result["bytesRead"] += len(data)
                remaining -= len(data)
                digest.update(data)
            after = os.fstat(handle.fileno())
            if (
                remaining
                or after.st_size != before.st_size
                or after.st_mtime_ns != before.st_mtime_ns
            ):
                result.update(
                    error="Host preflight: EXECUTABLE_CHANGED",
                    hashStatus="INCOMPLETE_CHANGED",
                )
            else:
                result.update(sha256=digest.hexdigest(), hashStatus="FULL_SHA256")
    except OSError as error:
        result.update(
            error=f"Host preflight: EXECUTABLE_READ errno={error.errno}",
            hashStatus="UNAVAILABLE",
        )
    return result


def query(command: list[str], timeout_seconds: float = 10) -> dict:
    origin = time.monotonic()
    buffers = {"stdout": bytearray(), "stderr": bytearray()}
    result = {"command": command, "exitCode": None, "forced": False, "reaped": False}
    child = None
    selector = selectors.DefaultSelector()
    try:
        child = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
            env={
                "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
                "HOME": "/nonexistent",
                "LC_ALL": "C",
                "TERM": "dumb",
                "MISE_AUTO_INSTALL": "false",
                "MISE_TASK_RUN_AUTO_INSTALL": "false",
            },
        )
        for name in buffers:
            stream = getattr(child, name)
            os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_READ, name)
        while selector.get_map() or child.poll() is None:
            if time.monotonic() >= origin + timeout_seconds:
                raise RuntimeError("Host preflight: COMMAND_DEADLINE")
            for key, _ in selector.select(0.01):
                data = os.read(key.fileobj.fileno(), 65536)
                if not data:
                    selector.unregister(key.fileobj)
                    key.fileobj.close()
                    continue
                left = OUTPUT_BYTES - sum(map(len, buffers.values()))
                buffers[key.data].extend(data[:left])
                if len(data) > left:
                    raise RuntimeError("Host preflight: COMMAND_BYTE_BOUND")
        result["exitCode"] = child.wait(timeout=0)
        if result["exitCode"] != 0:
            raise RuntimeError("Host preflight: COMMAND_EXIT")
    except (OSError, RuntimeError, subprocess.TimeoutExpired) as error:
        result["error"] = str(error)
    finally:
        selector.close()
        if child is not None:
            try:
                os.killpg(child.pid, signal.SIGKILL)
                result["forced"] = True
            except ProcessLookupError:
                pass
            try:
                result["exitCode"] = child.wait(timeout=2)
                result["reaped"] = True
            except subprocess.TimeoutExpired:
                result["error"] = "Host preflight: CLEANUP_DEADLINE"
            for name in buffers:
                getattr(child, name).close()
        result.update(
            {
                name: bytes(data).decode("utf-8", errors="replace")
                for name, data in buffers.items()
            }
        )
        result["elapsedMs"] = (time.monotonic() - origin) * 1000
    return result


def collect(sbx_contract: bool = False) -> dict:
    result = {
        "version": "chess-coach.host-preflight.v2",
        "executionRealm": "OPERATOR_ASSERTED_HOST_UNQUALIFIED",
        "scope": "LOCAL_TOOL_IDENTITY_AND_HELP_ONLY",
        "tools": {},
        "provisioningAuthorized": False,
        "trainingAuthorized": False,
        "trainingReady": False,
        "status": "PASS_METADATA_ONLY",
    }
    if sbx_contract:
        result.update(
            version="chess-coach.sbx-contract.v1",
            scope="LOCAL_TOOL_METADATA_AND_FIXED_SUBCOMMAND_HELP_ONLY",
        )
    commands = (
        tuple(("sbx", [verb, "--help"]) for verb in SBX_HELP)
        if sbx_contract
        else (("mise", ["--version"]), ("sbx", ["--help"]))
    )
    for name, arguments in commands:
        try:
            tool = result["tools"].get(name)
            if tool is None:
                path = shutil.which(name)
                if path is None:
                    raise FileNotFoundError(f"Host preflight: MISSING_{name.upper()}")
                tool = identity(path)
                tool["selectedPath"] = str(Path(path).absolute())
                result["tools"][name] = tool
                if "error" in tool:
                    result["status"] = "BLOCKED"
                    break
            receipt = query([tool["selectedPath"], *arguments])
            if sbx_contract:
                tool.setdefault("queries", []).append(receipt)
            else:
                tool["query"] = receipt
            if "error" in receipt or receipt["forced"] or not receipt["reaped"]:
                result["status"] = "BLOCKED"
        except (OSError, ValueError) as error:
            result["tools"].setdefault(name, {})["error"] = str(error)
            result["status"] = "BLOCKED"
        if result["status"] == "BLOCKED":
            break
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Host-only metadata preflight; no provisioning, installation or training."
    )
    parser.add_argument(
        "--sbx-contract",
        action="store_true",
        help="Collect only the six fixed sbx subcommand help pages; never run the operations.",
    )
    parser.add_argument(
        "--confirm-host",
        action="store_true",
        required=True,
        help="Operator assertion, not proof of the execution realm.",
    )
    arguments = parser.parse_args()
    result = collect(arguments.sbx_contract)
    print(json.dumps(result, sort_keys=True))
    return 0 if result["status"] == "PASS_METADATA_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
