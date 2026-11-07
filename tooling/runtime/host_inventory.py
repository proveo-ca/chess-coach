# SPEC: _spec/gate-closure.puml
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import selectors
import subprocess
import time


FILES = (
    "/proc/sys/kernel/hostname",
    "/proc/meminfo",
    "/proc/self/status",
    "/proc/self/cgroup",
    "/sys/devices/system/cpu/online",
    "/sys/devices/system/cpu/present",
    *(
        "/sys/fs/cgroup/" + name
        for name in (
            "cpuset.cpus.effective",
            "cpu.max",
            "memory.max",
            "memory.current",
            "memory.swap.max",
            "memory.swap.current",
            "pids.max",
            "pids.current",
        )
    ),
)
VERSION_FORMAT = (
    "{{json .Client.Version}} {{json .Server.Version}} {{json .Server.APIVersion}}"
)
INFO_FORMAT = "{{json .Name}} {{json .NCPU}} {{json .MemTotal}} {{json .CgroupDriver}} {{json .CgroupVersion}} {{json .DockerRootDir}} {{json .OperatingSystem}} {{json .KernelVersion}}"


def now_ns() -> int:
    return time.clock_gettime_ns(time.CLOCK_BOOTTIME)


def json_values(text: str, count: int) -> list:
    decoder = json.JSONDecoder()
    values = []
    remaining = text.strip()
    while remaining:
        value, used = decoder.raw_decode(remaining)
        values.append(value)
        remaining = remaining[used:].lstrip()
    if len(values) != count:
        raise ValueError("Inventory: PROJECTED_FIELD_COUNT")
    return values


def cpu_ids(text: str) -> list[int]:
    result: set[int] = set()
    for item in text.strip().split(","):
        if not re.fullmatch(r"[0-9]+(?:-[0-9]+)?", item):
            raise ValueError("Inventory: CPU_SET")
        start, _, end = item.partition("-")
        first, last = int(start), int(end or start)
        if last < first or last > 1_048_575 or last - first > 8191:
            raise ValueError("Inventory: CPU_BOUND")
        result.update(range(first, last + 1))
        if len(result) > 8192:
            raise ValueError("Inventory: CPU_BOUND")
    return sorted(result)


def calculate(info: list, observed: dict) -> dict:
    hostname = observed.get("/proc/sys/kernel/hostname", {}).get("value", "").strip()
    sets = []
    for path in (
        "/sys/devices/system/cpu/online",
        "/sys/devices/system/cpu/present",
        "/sys/fs/cgroup/cpuset.cpus.effective",
    ):
        value = observed.get(path, {}).get("value")
        if value:
            sets.append(set(cpu_ids(value)))
    status = observed.get("/proc/self/status", {}).get("value", {})
    if status.get("Cpus_allowed_list"):
        sets.append(set(cpu_ids(status["Cpus_allowed_list"])))
    candidates = sorted(set.intersection(*sets))[:12] if len(sets) == 4 else []
    view = (
        "MISMATCH"
        if hostname and hostname != info[0]
        else "UNQUALIFIED_EQUAL_NAME"
        if hostname
        else "UNKNOWN"
    )
    return {
        "daemonHostObservationBinding": view,
        "realmCandidateCpuIds": candidates,
        "unapprovedRealmJobCpuProposal": candidates[:4],
        "unapprovedRealmControlCpuProposal": candidates[4:6],
        "hardAggregateRamBytes": 24_000_000_000,
        "hardEligibleThreads": 12,
        "jobRamBytes": 8_589_934_592,
        "outsideRamProposalBytes": 2_147_483_648,
        "plannedRamSumBytes": 10_737_418_240,
        "persistentPayloadCeilingBytes": 214_748_364_800,
        "approvedHostCpuIds": None,
        "approvedCgroupParent": None,
        "approvedStateSource": None,
        "trainingReady": False,
    }


def collect(root: Path, workspace: Path, origin: int) -> dict:
    deadline = origin + 30_000_000_000

    def check() -> None:
        if now_ns() >= deadline:
            raise RuntimeError("Inventory: DEADLINE")

    def query(role: str, arguments: list[str]) -> str:
        check()
        command = [
            "/usr/bin/docker",
            "--config",
            str(root / "empty-config"),
            "--host",
            "unix:///var/run/docker.sock",
            *arguments,
        ]
        command_deadline = min(deadline, now_ns() + 10_000_000_000)
        child = subprocess.Popen(
            command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env={
                "PATH": "/usr/local/bin:/usr/bin:/bin",
                "HOME": str(root / "empty-home"),
                "GOMAXPROCS": "2",
            },
        )
        selector = selectors.DefaultSelector()
        buffers = {"stdout": bytearray(), "stderr": bytearray()}
        for name in buffers:
            stream = getattr(child, name)
            os.set_blocking(stream.fileno(), False)
            selector.register(stream, selectors.EVENT_READ, name)
        forced = False
        try:
            while selector.get_map() or child.poll() is None:
                check()
                if now_ns() >= command_deadline:
                    raise RuntimeError("Inventory: COMMAND_DEADLINE")
                for key, _ in selector.select(0.01):
                    data = os.read(key.fileobj.fileno(), 65536)
                    if not data:
                        selector.unregister(key.fileobj)
                        key.fileobj.close()
                    else:
                        left = 65536 - sum(map(len, buffers.values()))
                        buffers[key.data].extend(data[:left])
                        if len(data) > left:
                            raise RuntimeError("Inventory: COMMAND_BYTE_BOUND")
            code = child.wait(timeout=0)
            if code != 0:
                raise RuntimeError("Inventory: COMMAND_EXIT")
            return buffers["stdout"].decode("utf-8", errors="strict")
        except BaseException:
            forced = True
            if child.poll() is None:
                child.kill()
            child.wait(timeout=max(0.001, (origin + 32_000_000_000 - now_ns()) / 1e9))
            raise
        finally:
            selector.close()
            for name, value in buffers.items():
                (root / f"{role}.{name}").write_bytes(value)
            (root / f"{role}.receipt.json").write_text(
                json.dumps(
                    {
                        "command": command,
                        "exitCode": child.returncode,
                        "forced": forced,
                        "reaped": child.returncode is not None,
                        "completedNs": now_ns(),
                    }
                )
            )

    check()
    (root / "empty-config").mkdir(mode=0o700)
    (root / "empty-home").mkdir(mode=0o700)
    version = json_values(query("version", ["version", "--format", VERSION_FORMAT]), 3)
    info = json_values(query("info", ["info", "--format", INFO_FORMAT]), 8)
    observed = {}
    selected = {
        "/proc/meminfo": {"MemTotal", "MemAvailable", "SwapTotal", "SwapFree"},
        "/proc/self/status": {"Cpus_allowed_list", "Uid"},
    }
    for path in FILES:
        check()
        try:
            with open(path, "rb") as handle:
                raw = handle.read(65537)
            if len(raw) > 65536:
                raise RuntimeError("Inventory: FILE_BYTE_BOUND")
            value = raw.decode("ascii", errors="strict")
            if path in selected:
                value = {
                    key: text.strip()
                    for line in value.splitlines()
                    if ":" in line
                    for key, text in [line.split(":", 1)]
                    if key in selected[path]
                }
            observed[path] = {"value": value}
        except OSError as error:
            observed[path] = {"unavailable": error.errno}
    filesystems = {}
    paths = [str(workspace), "/tmp/opencode"]
    docker_root = info[5]
    if (
        isinstance(docker_root, str)
        and docker_root.startswith("/")
        and "\x00" not in docker_root
        and ".." not in docker_root.split("/")
    ):
        paths.append(docker_root)
    for path in dict.fromkeys(paths):
        check()
        try:
            value = os.statvfs(path)
            filesystems[path] = {
                "capacityBytes": value.f_blocks * value.f_frsize,
                "availableBytes": value.f_bavail * value.f_frsize,
                "availableInodes": value.f_favail,
                "freeInodes": value.f_ffree,
                "flags": value.f_flag,
            }
        except OSError as error:
            filesystems[path] = {"unavailable": error.errno}
    executables = {}
    for path in ("/usr/bin/python3", "/usr/bin/docker"):
        check()
        try:
            digest, size = hashlib.sha256(), 0
            with open(path, "rb") as handle:
                if not __import__("stat").S_ISREG(os.fstat(handle.fileno()).st_mode):
                    raise RuntimeError("Inventory: EXECUTABLE_KIND")
                while data := handle.read(65536):
                    check()
                    digest.update(data)
                    size += len(data)
            executables[path] = {
                "resolvedPath": os.path.realpath(path),
                "byteLength": size,
                "sha256": digest.hexdigest(),
            }
        except OSError as error:
            executables[path] = {"unavailable": error.errno}
    check()
    return {
        "scope": "C16_READ_ONLY_BINDING_PROPOSALS_NOT_QUALIFICATION",
        "originNs": origin,
        "completedNs": now_ns(),
        "version": version,
        "daemon": dict(
            zip(
                (
                    "name",
                    "cpus",
                    "memoryBytes",
                    "cgroupDriver",
                    "cgroupVersion",
                    "dockerRootDir",
                    "operatingSystem",
                    "kernelVersion",
                ),
                info,
            )
        ),
        "realm": observed,
        "filesystems": filesystems,
        "executables": executables,
        "calculations": calculate(info, observed),
    }


if __name__ == "__main__":
    import sys

    if len(sys.argv) != 4:
        raise SystemExit(
            "Usage: host_inventory.py PRIVATE_EVIDENCE_ROOT WORKSPACE ORIGINAL_BOOTTIME_NS"
        )
    target = Path(sys.argv[1])
    try:
        result = collect(target, Path(sys.argv[2]), int(sys.argv[3]))
        encoded = json.dumps(result, indent=2).encode()
        if len(encoded) > 512 * 1024:
            raise RuntimeError("Inventory: EVIDENCE_BOUND")
        (target / "inventory.json").write_bytes(encoded)
    except BaseException as error:
        (target / "failure.json").write_text(
            json.dumps({"error": str(error), "type": type(error).__name__})
        )
        raise
