# SPEC: _spec/gate-closure.puml
from __future__ import annotations

import json
from pathlib import Path
import re
import sys
import time


PAYLOAD_BYTES = 204 * 1024**3


def partitions(text: str) -> list[dict]:
    records = []
    for line in text.splitlines():
        if not line.strip() or line.split() == ["major", "minor", "#blocks", "name"]:
            continue
        fields = line.split()
        if (
            len(fields) != 4
            or not all(re.fullmatch(r"[0-9]+", field) for field in fields[:3])
            or not re.fullmatch(r"[A-Za-z0-9_-]+", fields[3])
        ):
            raise ValueError("Backing inventory: PARTITIONS_SCHEMA")
        major, minor, blocks = map(int, fields[:3])
        if blocks > 2**63 // 1024:
            raise ValueError("Backing inventory: SIZE_BOUND")
        records.append(
            {
                "name": fields[3],
                "device": f"{major}:{minor}",
                "procCapacityBytes": blocks * 1024,
            }
        )
        if len(records) > 128:
            raise ValueError("Backing inventory: RECORD_BOUND")
    if len({record["name"] for record in records}) != len(records):
        raise ValueError("Backing inventory: DUPLICATE")
    return records


def collect(origin_ns: int) -> dict:
    deadline = origin_ns + 10_000_000_000

    def read(path: str, bound: int) -> dict:
        if time.clock_gettime_ns(time.CLOCK_BOOTTIME) >= deadline:
            raise RuntimeError("Backing inventory: DEADLINE")
        try:
            with open(path, "rb") as handle:
                value = handle.read(bound + 1)
            if len(value) > bound:
                raise RuntimeError("Backing inventory: BYTE_BOUND")
            return {"value": value.decode("ascii", errors="strict").strip()}
        except OSError as error:
            return {"unavailable": error.errno}

    source = read("/proc/partitions", 65536)
    if "value" not in source:
        raise RuntimeError("Backing inventory: PARTITIONS_UNAVAILABLE")
    devices = partitions(source["value"])
    for device in devices:
        root = "/sys/class/block/" + device["name"]
        device["metadata"] = {
            name: read(root + "/" + name, 4096)
            for name in ("dev", "size", "ro", "partition")
        }
        size = device["metadata"]["size"].get("value")
        device["sysfsCapacityBytes"] = (
            int(size) * 512 if size and re.fullmatch(r"[0-9]+", size) else None
        )
        device["coversPayloadCeiling"] = (
            device["sysfsCapacityBytes"]
            if device["sysfsCapacityBytes"] is not None
            else device["procCapacityBytes"]
        ) >= PAYLOAD_BYTES
        device["ownershipOrReuseApproved"] = False
    if time.clock_gettime_ns(time.CLOCK_BOOTTIME) >= deadline:
        raise RuntimeError("Backing inventory: DEADLINE")
    return {
        "scope": "C19_VISIBLE_CAPACITY_ONLY_NOT_DEVICE_OWNERSHIP",
        "originNs": origin_ns,
        "completedNs": time.clock_gettime_ns(time.CLOCK_BOOTTIME),
        "requiredPayloadBytes": PAYLOAD_BYTES,
        "devices": devices,
        "candidateNames": [
            device["name"] for device in devices if device["coversPayloadCeiling"]
        ],
        "trainingReady": False,
    }


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: backing_inventory.py PRIVATE_EVIDENCE_ROOT ORIGINAL_BOOTTIME_NS"
        )
    root = Path(sys.argv[1])
    try:
        value = json.dumps(collect(int(sys.argv[2])), indent=2)
        if len(value.encode()) > 96 * 1024:
            raise RuntimeError("Backing inventory: EVIDENCE_BOUND")
        (root / "backing.json").write_text(value)
    except BaseException as error:
        (root / "failure.json").write_text(
            json.dumps({"type": type(error).__name__, "error": str(error)})
        )
        raise
