#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import re
import stat
import sys


MAX_RECORD = 8192
MAX_FILE = 2 * 1024**3
MAX_TOTAL = 4 * 1024**3
NAME = re.compile(r"[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}\Z")
DIGEST = re.compile(r"[0-9a-f]{64}\Z")


def stop(message):
    print(f"STOP: {message}", file=sys.stderr)
    return 2


def directory_fd(path):
    if not os.path.isabs(path) or os.path.normpath(path) != path:
        raise ValueError("use a canonical absolute path")
    fd = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
    try:
        for component in path.split("/")[1:]:
            if not component:
                continue
            next_fd = os.open(
                component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=fd
            )
            os.close(fd)
            fd = next_fd
        return fd
    except (OSError, ValueError):
        os.close(fd)
        raise


def file_fd(parent, name):
    if not NAME.fullmatch(name) or name in (".", ".."):
        raise ValueError("invalid file name")
    fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=parent)
    if not stat.S_ISREG(os.fstat(fd).st_mode):
        os.close(fd)
        raise ValueError("not a regular file")
    return fd


def read_record(parent, name):
    with os.fdopen(file_fd(parent, name), "rb") as stream:
        if os.fstat(stream.fileno()).st_size > MAX_RECORD:
            raise ValueError("record too large")
        data = stream.read(MAX_RECORD + 1)
    if len(data) > MAX_RECORD:
        raise ValueError("record too large")
    return data


def unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("duplicate record key")
        result[key] = value
    return result


def checked_record(data):
    record = json.loads(data, object_pairs_hook=unique_pairs)
    if not isinstance(record, dict) or set(record) != {"schema", "inputs"}:
        raise ValueError("unexpected record shape")
    entries = record["inputs"]
    if (
        record["schema"] != "f9-offline-bytes-v1"
        or not isinstance(entries, dict)
        or not 1 <= len(entries) <= 32
    ):
        raise ValueError("unsupported record")
    total = 0
    for name, entry in entries.items():
        if not isinstance(name, str) or not NAME.fullmatch(name) or name in (".", ".."):
            raise ValueError("invalid input name")
        if not isinstance(entry, dict) or set(entry) != {"sha256", "bytes"}:
            raise ValueError("invalid input entry")
        size = entry["bytes"]
        if (
            type(size) is not int
            or not 0 <= size <= MAX_FILE
            or not isinstance(entry["sha256"], str)
            or not DIGEST.fullmatch(entry["sha256"])
        ):
            raise ValueError("invalid input pin")
        total += size
    if total > MAX_TOTAL:
        raise ValueError("input limit exceeded")
    return entries


def verify(inputs, record_path, expected):
    if not DIGEST.fullmatch(expected):
        raise ValueError("invalid expected record digest")
    if any(
        not os.path.isabs(path) or os.path.normpath(path) != path
        for path in (inputs, record_path)
    ):
        raise ValueError("use canonical absolute paths")
    if os.path.commonpath((inputs, record_path)) == inputs:
        raise ValueError("trust record must be outside inputs")
    record_dir = directory_fd(os.path.dirname(record_path))
    try:
        data = read_record(record_dir, os.path.basename(record_path))
    finally:
        os.close(record_dir)
    if hashlib.sha256(data).hexdigest() != expected:
        raise ValueError("record digest mismatch")
    entries = checked_record(data)
    input_dir = directory_fd(inputs)
    try:
        if set(os.listdir(input_dir)) != set(entries):
            raise ValueError("input file set mismatch")
        for name, entry in entries.items():
            with os.fdopen(file_fd(input_dir, name), "rb") as stream:
                if os.fstat(stream.fileno()).st_size != entry["bytes"]:
                    raise ValueError("input size mismatch")
                digest = hashlib.sha256()
                count = 0
                while chunk := stream.read(
                    min(1024 * 1024, entry["bytes"] - count + 1)
                ):
                    count += len(chunk)
                    if count > entry["bytes"]:
                        raise ValueError("input size changed")
                    digest.update(chunk)
                if count != entry["bytes"] or digest.hexdigest() != entry["sha256"]:
                    raise ValueError("input digest mismatch")
    finally:
        os.close(input_dir)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--inputs", required=True)
    parser.add_argument("--trust-record", required=True)
    parser.add_argument("--expected-record-sha256", required=True)
    parser.add_argument("--offline-only", action="store_true", required=True)
    args = parser.parse_args()
    try:
        verify(args.inputs, args.trust_record, args.expected_record_sha256)
    except (OSError, ValueError, TypeError) as error:
        return stop(str(error))
    print("OFFLINE_PINNED_BYTES_ONLY")
    return 0


if __name__ == "__main__":
    sys.exit(main())
