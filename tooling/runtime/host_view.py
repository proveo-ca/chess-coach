# SPEC: _spec/gate-closure.puml
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import stat
import sys
import time


SELF_CGROUP = "/docker/34a06450976a7fd5baf99e5f9a85ff3f6cd12d3b0cc542157d2b86b5ea5b05e4"
ROOTS = ("/sys/fs/cgroup", "/sys/fs/cgroup/docker", "/sys/fs/cgroup" + SELF_CGROUP)
CONTROL = (
    "cgroup.controllers",
    "cgroup.subtree_control",
    "cpuset.cpus.effective",
    "cpu.max",
    "memory.max",
    "memory.current",
    "memory.swap.max",
    "memory.swap.current",
    "pids.max",
    "pids.current",
)


def mount_projection(text: str) -> list[dict]:
    def unescape(value: str) -> str:
        return re.sub(r"\\([0-7]{3})", lambda match: chr(int(match[1], 8)), value)

    selected = []
    for line in text.splitlines():
        left, separator, right = line.partition(" - ")
        fields, filesystem = left.split(), right.split()
        if not separator or len(fields) < 6 or len(filesystem) < 3:
            raise ValueError("Host view: MOUNTINFO")
        kind, point = filesystem[0], unescape(fields[4])
        cgroup = kind in ("cgroup", "cgroup2")
        local = kind in ("ext4", "xfs", "btrfs", "overlay", "zfs") and "rw" in fields[
            5
        ].split(",")
        excluded = any(
            point == prefix or point.startswith(prefix + "/")
            for prefix in ("/proc", "/sys", "/dev")
        )
        if cgroup or local and not excluded:
            selected.append(
                {
                    "mountId": fields[0],
                    "parentId": fields[1],
                    "device": fields[2],
                    "root": unescape(fields[3]),
                    "mountpoint": point,
                    "options": fields[5],
                    "filesystem": kind,
                    "cgroup": cgroup,
                }
            )
    return selected


def collect(origin_ns: int) -> dict:
    deadline = origin_ns + 10_000_000_000

    def check() -> None:
        if time.clock_gettime_ns(time.CLOCK_BOOTTIME) >= deadline:
            raise RuntimeError("Host view: DEADLINE")

    def read(path: str, bound: int = 65536) -> dict:
        check()
        try:
            with open(path, "rb") as handle:
                value = handle.read(bound + 1)
            if len(value) > bound:
                raise RuntimeError("Host view: FILE_BOUND")
            return {"value": value.decode("ascii", errors="strict")}
        except OSError as error:
            return {"unavailable": error.errno}

    membership = read("/proc/self/cgroup")
    if membership.get("value", "").strip() != "0::" + SELF_CGROUP:
        raise RuntimeError("Host view: SELF_MEMBERSHIP_CHANGED")
    mountinfo = read("/proc/self/mountinfo", 256 * 1024)
    mounts = mount_projection(mountinfo["value"]) if "value" in mountinfo else []
    controls = {}
    for root, names in zip(ROOTS, (CONTROL[:2], CONTROL[:3], CONTROL)):
        for name in names:
            path = root + "/" + name
            controls[path] = read(path)
    directories = {}
    for path in (*ROOTS, "/var/lib/docker"):
        check()
        try:
            value = os.lstat(path)
            directories[path] = {
                "device": value.st_dev,
                "inode": value.st_ino,
                "uid": value.st_uid,
                "gid": value.st_gid,
                "mode": stat.S_IMODE(value.st_mode),
                "directory": stat.S_ISDIR(value.st_mode),
                "symlink": stat.S_ISLNK(value.st_mode),
            }
        except OSError as error:
            directories[path] = {"unavailable": error.errno}
    filesystems = {}
    for mount in [entry for entry in mounts if not entry["cgroup"]][:8]:
        path = mount["mountpoint"]
        check()
        try:
            value = os.statvfs(path)
            filesystems[path] = {
                "capacityBytes": value.f_blocks * value.f_frsize,
                "availableBytes": value.f_bavail * value.f_frsize,
                "availableInodes": value.f_favail,
                "flags": value.f_flag,
            }
        except OSError as error:
            filesystems[path] = {"unavailable": error.errno}
    check()
    return {
        "scope": "C17_EXACT_READ_ONLY_VIEW_NOT_QUALIFICATION",
        "originNs": origin_ns,
        "completedNs": time.clock_gettime_ns(time.CLOCK_BOOTTIME),
        "membership": membership,
        "mounts": mounts,
        "controls": controls,
        "directories": directories,
        "filesystems": filesystems,
        "trainingReady": False,
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: host_view.py PRIVATE_EVIDENCE_ROOT ORIGINAL_BOOTTIME_NS"
        )
    target = Path(sys.argv[1])
    try:
        value = json.dumps(collect(int(sys.argv[2])), indent=2)
        if len(value.encode()) > 192 * 1024:
            raise RuntimeError("Host view: EVIDENCE_BOUND")
        (target / "view.json").write_text(value)
    except BaseException as error:
        (target / "failure.json").write_text(
            json.dumps({"type": type(error).__name__, "error": str(error)})
        )
        raise
