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


def identity(path: str) -> dict:
    resolved = Path(path).resolve(strict=True)
    digest = hashlib.sha256()
    with resolved.open("rb") as handle:
        info = os.fstat(handle.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > EXECUTABLE_BYTES:
            raise ValueError("Host preflight: EXECUTABLE_BOUND_OR_KIND")
        size = 0
        while data := handle.read(65536):
            size += len(data)
            if size > EXECUTABLE_BYTES:
                raise ValueError("Host preflight: EXECUTABLE_BOUND")
            digest.update(data)
    return {
        "selectedPath": path,
        "resolvedPath": str(resolved),
        "byteLength": size,
        "sha256": digest.hexdigest(),
        "device": info.st_dev,
        "inode": info.st_ino,
    }


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


def collect() -> dict:
    result = {
        "version": "chess-coach.host-preflight.v1",
        "executionRealm": "OPERATOR_ASSERTED_HOST_UNQUALIFIED",
        "scope": "LOCAL_TOOL_IDENTITY_AND_HELP_ONLY",
        "tools": {},
        "provisioningAuthorized": False,
        "trainingAuthorized": False,
        "trainingReady": False,
        "status": "PASS_METADATA_ONLY",
    }
    for name, arguments in (("mise", ["--version"]), ("sbx", ["--help"])):
        try:
            path = shutil.which(name)
            if path is None:
                raise FileNotFoundError(f"Host preflight: MISSING_{name.upper()}")
            tool = identity(path)
            result["tools"][name] = tool
            tool["query"] = query([tool["resolvedPath"], *arguments])
            if (
                "error" in tool["query"]
                or tool["query"]["forced"]
                or not tool["query"]["reaped"]
            ):
                result["status"] = "BLOCKED"
        except (OSError, ValueError) as error:
            result["tools"][name] = {"error": str(error)}
            result["status"] = "BLOCKED"
        if result["status"] == "BLOCKED":
            break
    return result


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Host-only metadata preflight; no provisioning, installation or training."
    )
    parser.add_argument(
        "--confirm-host",
        action="store_true",
        required=True,
        help="Operator assertion, not proof of the execution realm.",
    )
    parser.parse_args()
    result = collect()
    print(json.dumps(result, sort_keys=True))
    return 0 if result["status"] == "PASS_METADATA_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
