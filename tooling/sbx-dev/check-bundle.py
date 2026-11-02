#!/usr/bin/env python3
import hashlib
import pathlib
import re
import sys
import tarfile


def check(path, expected):
    archive = pathlib.Path(path)
    if (
        not archive.is_file()
        or archive.is_symlink()
        or archive.stat().st_size > 2 * 1024**3
    ):
        raise ValueError("archive is not a regular file within the 2 GiB cap")
    digest = hashlib.sha256()
    with archive.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    if digest.hexdigest() != expected:
        raise ValueError("archive digest mismatch")
    names = set()
    tools = set()
    total = 0
    with tarfile.open(archive, "r:*") as bundle:
        for member in bundle:
            name = member.name
            normalized = name.rstrip("/") if member.isdir() else name
            parts = normalized.split("/")
            if (
                not normalized
                or len(name) > 256
                or not all(
                    re.fullmatch(r"[A-Za-z0-9_.+-]+", p) and p not in (".", "..")
                    for p in parts
                )
                or not (member.isfile() or member.isdir())
                or normalized in names
            ):
                raise ValueError("unsafe or duplicate bundle member")
            names.add(normalized)
            if (
                normalized in ("bin/rustc", "bin/cargo")
                and member.isfile()
                and member.mode & 0o111
            ):
                tools.add(normalized)
            total += member.size
            if len(names) > 20000 or total > 4 * 1024**3:
                raise ValueError("expanded bundle exceeds cap")
    for tool in ("bin/rustc", "bin/cargo"):
        if tool not in tools:
            raise ValueError(f"bundle must contain executable {tool}")
    print("BUNDLE=HASH_AND_LAYOUT_OK")


if __name__ == "__main__":
    try:
        if (
            len(sys.argv) != 3
            or len(sys.argv[2]) != 64
            or any(c not in "0123456789abcdef" for c in sys.argv[2])
        ):
            raise ValueError("usage: check-bundle.py ARCHIVE SHA256_LOWERCASE")
        check(sys.argv[1], sys.argv[2])
    except (OSError, tarfile.TarError, ValueError) as error:
        print(f"STOP: {error}", file=sys.stderr)
        sys.exit(2)
