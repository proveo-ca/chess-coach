# SPEC: _spec/host-entrypoint.puml, _spec/gpu-readiness.puml
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
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
HOST_FILES = (
    "/proc/meminfo",
    "/sys/devices/system/cpu/online",
    "/sys/devices/system/cpu/present",
    "/proc/self/cgroup",
)
NVIDIA_QUERY = (
    "--query-gpu=index,uuid,name,memory.total,driver_version,pci.bus_id",
    "--format=csv,noheader,nounits",
)


def gpu_metadata() -> dict:
    result = {"qualification": "NOT_QUALIFIED", "drmCards": []}
    try:
        with os.scandir("/sys/class/drm") as entries:
            for ordinal, entry in enumerate(entries):
                if ordinal >= 256:
                    raise ValueError("Host facts: DRM_ENTRY_BOUND")
                if not re.fullmatch(r"card[0-9]{1,3}", entry.name):
                    continue
                if len(result["drmCards"]) >= 16:
                    raise ValueError("Host facts: DRM_CARD_BOUND")
                card = {"name": entry.name, "fields": {}}
                device = Path("/sys/class/drm") / entry.name / "device"
                for name in ("vendor", "device", "class", "mem_info_vram_total"):
                    try:
                        card["fields"][name] = metadata_text(
                            str(device / name), 4096
                        ).strip()
                    except OSError as error:
                        card["fields"][name] = {"unavailableErrno": error.errno}
                try:
                    card["driver"] = Path(os.readlink(device / "driver")).name
                except OSError as error:
                    card["driver"] = {"unavailableErrno": error.errno}
                result["drmCards"].append(card)
    except OSError as error:
        result["drmUnavailableErrno"] = error.errno
    selected = shutil.which("nvidia-smi")
    if selected is None:
        result["nvidiaSmi"] = {
            "available": False,
            "meaning": "TOOL_ABSENT_NOT_PROOF_OF_NO_GPU",
        }
        return result
    tool = identity(selected)
    tool["selectedPath"] = str(Path(selected).absolute())
    result["nvidiaSmi"] = tool
    if "error" not in tool:
        tool["query"] = query([tool["selectedPath"], *NVIDIA_QUERY])
    return result


def metadata_text(path: str, limit: int = 65536) -> str:
    with open(path, "rb") as handle:
        data = handle.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Host facts: FILE_BYTE_BOUND")
    return data.decode("utf-8", errors="strict")


def filesystem_metadata(path: Path) -> dict:
    selected = path.absolute()
    if len(selected.parts) > 64 or ".." in selected.parts:
        raise ValueError("Host facts: PATH")
    info = selected.lstat()
    if not stat.S_ISDIR(info.st_mode) or selected.resolve(strict=True) != selected:
        raise ValueError("Host facts: EXISTING_NONSYMLINK_DIRECTORY")
    value = os.statvfs(selected)
    return {
        "path": str(selected),
        "device": info.st_dev,
        "inode": info.st_ino,
        "uid": info.st_uid,
        "gid": info.st_gid,
        "mode": stat.filemode(info.st_mode),
        "capacityBytes": value.f_blocks * value.f_frsize,
        "availableBytes": value.f_bavail * value.f_frsize,
        "availableEntries": value.f_favail,
        "freeEntries": value.f_ffree,
        "filesystemId": value.f_fsid,
        "flags": value.f_flag,
        "writableAndSearchable": os.access(selected, os.W_OK | os.X_OK),
    }


def mount_projection(text: str, path: Path) -> dict:
    selected = path.absolute()
    best = None
    for line in text.splitlines():
        head, separator, tail = line.partition(" - ")
        fields, filesystem = head.split(), tail.split()
        if not separator or len(fields) < 6 or len(filesystem) < 3:
            raise ValueError("Host facts: MOUNTINFO")
        mountpoint = re.sub(
            r"\\([0-7]{3})", lambda match: chr(int(match[1], 8)), fields[4]
        )
        candidate = Path(mountpoint)
        if not candidate.is_absolute():
            raise ValueError("Host facts: MOUNTPOINT")
        if selected == candidate or selected.is_relative_to(candidate):
            if best is None or len(candidate.parts) >= len(
                Path(best["mountpoint"]).parts
            ):
                best = {
                    "mountpoint": mountpoint,
                    "majorMinor": fields[2],
                    "filesystemType": filesystem[0],
                    "mountOptions": fields[5],
                }
    if best is None:
        raise ValueError("Host facts: MOUNT_NOT_FOUND")
    return best


def host_facts(
    result: dict, state_parent: str | None, workspace: Path | None = None
) -> None:
    if sys.platform != "linux":
        raise ValueError("Host facts: LINUX_REQUIRED")
    source = (workspace or Path(__file__).resolve().parents[2]).absolute()
    parent_text = (
        state_parent
        if state_parent is not None
        else os.environ.get("XDG_STATE_HOME") or str(Path.home() / ".local/state")
    )
    parent = Path(parent_text)
    if not parent.is_absolute() or len(parent.parts) > 64 or ".." in parent.parts:
        raise ValueError("Host facts: ABSOLUTE_STATE_PARENT")
    if (
        parent == source
        or parent.is_relative_to(source)
        or source.is_relative_to(parent)
    ):
        raise ValueError("Host facts: STATE_PARENT_OVERLAPS_SOURCE")
    result.update(
        observation="POINT_IN_TIME_NOT_CAPACITY_RESERVATION",
        runtimeAdmissionQualified=False,
        selection={
            "stateParent": str(parent),
            "applicationRootProposal": str(parent / "chess-coach"),
            "workspace": str(source),
        },
        caller={
            "uid": os.getuid(),
            "gid": os.getgid(),
            "effectiveUid": os.geteuid(),
            "effectiveGid": os.getegid(),
        },
    )
    result["kernel"] = {"release": os.uname().release, "machine": os.uname().machine}
    affinity = sorted(os.sched_getaffinity(0))
    if not affinity or len(affinity) > 8192:
        raise ValueError("Host facts: AFFINITY_BOUND")
    result["selfAffinityCpuIds"] = affinity
    result["observed"] = {}
    for path in HOST_FILES:
        text = metadata_text(path)
        if path == "/proc/meminfo":
            memory = {}
            for line in text.splitlines():
                key, _, value = line.partition(":")
                if key in ("MemTotal", "MemAvailable", "SwapTotal", "SwapFree"):
                    if not re.fullmatch(r"\s*[0-9]{1,18}\s+kB\s*", value):
                        raise ValueError("Host facts: MEMORY_UNIT")
                    memory[key + "Bytes"] = int(value.split()[0]) * 1024
            if len(memory) != 4:
                raise ValueError("Host facts: MEMORY_FIELDS")
            result["observed"][path] = memory
        else:
            result["observed"][path] = text.strip()
    result["filesystems"] = {
        "stateParent": filesystem_metadata(parent),
        "workspace": filesystem_metadata(source),
    }
    mounts = metadata_text("/proc/self/mountinfo", 256 * 1024)
    for key, path in (("stateParent", parent), ("workspace", source)):
        result["filesystems"][key]["mount"] = mount_projection(mounts, path)
    result["gpu"] = gpu_metadata()
    gpu_query = result["gpu"].get("nvidiaSmi", {})
    receipt = gpu_query.get("query")
    if (
        "error" in gpu_query
        or receipt is not None
        and ("error" in receipt or receipt["forced"] or not receipt["reaped"])
    ):
        raise ValueError("Host facts: GPU_METADATA_QUERY_FAILED")


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


def collect(
    sbx_contract: bool = False,
    *,
    admission_facts: bool = False,
    state_parent: str | None = None,
) -> dict:
    if (
        sbx_contract
        and admission_facts
        or state_parent is not None
        and not admission_facts
    ):
        raise ValueError("Host preflight: PROFILE_ARGUMENTS")
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
    if admission_facts:
        result.update(
            version="chess-coach.host-admission-facts.v1",
            scope="HOST_SELF_GPU_AND_SELECTED_FILESYSTEM_METADATA_ONLY",
            gpuLearningRequired=True,
            gpuQualification="NOT_QUALIFIED",
        )
        result["hostFacts"] = {}
        try:
            host_facts(result["hostFacts"], state_parent)
        except (OSError, ValueError) as error:
            result["hostFacts"]["error"] = str(error)
            result["status"] = "BLOCKED"
            return result
    commands = (
        (("docker", ["--version"]),)
        if admission_facts
        else tuple(("sbx", [verb, "--help"]) for verb in SBX_HELP)
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
    profiles = parser.add_mutually_exclusive_group()
    profiles.add_argument(
        "--sbx-contract",
        action="store_true",
        help="Collect only the six fixed sbx subcommand help pages; never run the operations.",
    )
    profiles.add_argument(
        "--admission-facts",
        action="store_true",
        help="Read host self CPU/RAM/GPU and selected existing filesystem metadata; create nothing.",
    )
    parser.add_argument(
        "--state-parent",
        help="Existing absolute parent directory to inspect; admission-facts only. Default: XDG_STATE_HOME or ~/.local/state.",
    )
    parser.add_argument(
        "--confirm-host",
        action="store_true",
        required=True,
        help="Operator assertion, not proof of the execution realm.",
    )
    arguments = parser.parse_args()
    if arguments.state_parent is not None and not arguments.admission_facts:
        parser.error("--state-parent requires --admission-facts")
    result = collect(
        arguments.sbx_contract,
        admission_facts=arguments.admission_facts,
        state_parent=arguments.state_parent,
    )
    print(json.dumps(result, sort_keys=True))
    return 0 if result["status"] == "PASS_METADATA_ONLY" else 1


if __name__ == "__main__":
    sys.exit(main())
