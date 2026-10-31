#!/usr/bin/env python3
import argparse
import json
import os
import re
import sys


def stop(message):
    print(f"STOP: {message}", file=sys.stderr)
    return 2


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--trust-record", required=True)
    parser.add_argument("--offline-only", action="store_true", required=True)
    args = parser.parse_args()
    if not os.path.isabs(args.inputs) or not os.path.isabs(args.trust_record):
        return stop("paths must be absolute")
    if os.path.islink(args.trust_record):
        return stop("trust record must not be a symlink")
    try:
        with open(args.trust_record, "rb") as record:
            data = record.read(8193)
    except OSError:
        return stop("trust record unavailable")
    if len(data) > 8192:
        return stop("trust record too large")
    try:
        value = json.loads(data)
    except (UnicodeError, ValueError):
        return stop("invalid trust record")
    if not isinstance(value, dict) or set(value) != {"schema", "pins"}:
        return stop("invalid trust record shape")
    if value["schema"] != "f9-host-sbx-candidate-v0" or not isinstance(
        value["pins"], dict
    ):
        return stop("unsupported trust record")
    pins = value["pins"]
    if set(pins) != {"linux", "llvm", "patch", "tools", "zig"}:
        return stop("incomplete candidate pins")
    if any(
        not isinstance(digest, str) or re.fullmatch(r"[0-9a-f]{64}", digest) is None
        for digest in pins.values()
    ):
        return stop("invalid candidate pin")
    return stop("candidate pin shape is not independent provenance authentication")


if __name__ == "__main__":
    sys.exit(main())
