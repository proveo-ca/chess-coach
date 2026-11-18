# SPEC: _spec/supervision.puml
from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path


class EvidencePacket:
    def __init__(
        self,
        root: Path,
        attempt_bytes: int = 512 * 1024 * 1024,
        packet_bytes: int = 4 * 1024 * 1024 * 1024,
        entries: int = 16384,
        file_bytes: int = 64 * 1024 * 1024,
    ):
        if (
            not root.is_absolute()
            or not 0 < file_bytes <= 64 * 1024 * 1024
            or not 0 < attempt_bytes <= 512 * 1024 * 1024
        ):
            raise ValueError("Evidence: LIMITS")
        if (
            not 0 < packet_bytes <= 4 * 1024 * 1024 * 1024
            or not 1 < entries <= 16384
            or file_bytes > attempt_bytes
            or attempt_bytes > packet_bytes
        ):
            raise ValueError("Evidence: LIMITS")
        root.mkdir(mode=0o700)
        self.root = root
        self.attempt_limit, self.packet_limit, self.entry_limit, self.file_limit = (
            attempt_bytes,
            packet_bytes,
            entries,
            file_bytes,
        )
        self.bytes, self.entries = 0, 1
        self.failed = False
        self.attempts: set[str] = set()
        self._sync_directory(root.parent)

    @staticmethod
    def _sync_directory(path: Path) -> None:
        descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)

    def attempt(self, name: str) -> AttemptEvidence:
        if (
            self.failed
            or not re.fullmatch(r"[A-Za-z0-9._:-]{1,64}", name)
            or name in self.attempts
        ):
            raise RuntimeError("Evidence: CLOSED_OR_ATTEMPT_REUSE")
        try:
            if self.entries + 1 > self.entry_limit:
                raise RuntimeError("Evidence: ENTRY_BOUND")
            self.entries += 1
            self.attempts.add(name)
            path = self.root / ("attempt-" + name)
            path.mkdir(mode=0o700)
            self._sync_directory(self.root)
            return AttemptEvidence(self, path)
        except BaseException:
            self.failed = True
            raise


class AttemptEvidence:
    def __init__(self, packet: EvidencePacket, root: Path):
        self.packet, self.root = packet, root
        self.bytes, self.ordinal = 0, 0
        self.busy = False

    @property
    def failed(self) -> bool:
        return self.packet.failed

    def write(self, role: str, payload: bytes) -> dict:
        packet = self.packet
        if packet.failed or self.busy:
            packet.failed = True
            raise RuntimeError("Evidence: CLOSED_OR_REENTRY")
        self.busy = True
        try:
            if (
                not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", role)
                or type(payload) is not bytes
            ):
                raise ValueError("Evidence: ROLE_OR_BYTES")
            size = len(payload)
            if (
                size > packet.file_limit
                or self.bytes + size > packet.attempt_limit
                or packet.bytes + size > packet.packet_limit
            ):
                raise RuntimeError("Evidence: BYTE_BOUND")
            if packet.entries + 1 > packet.entry_limit:
                raise RuntimeError("Evidence: ENTRY_BOUND")
            packet.entries += 1
            packet.bytes += size
            self.bytes += size
            ordinal = self.ordinal
            self.ordinal += 1
            name = f"{ordinal:06d}-{role}.bin"
            directory = os.open(self.root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
            try:
                descriptor = os.open(
                    name,
                    os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
                    0o600,
                    dir_fd=directory,
                )
                try:
                    remaining = memoryview(payload)
                    while remaining:
                        written = os.write(descriptor, remaining)
                        if written <= 0:
                            raise OSError("Evidence: SHORT_WRITE")
                        remaining = remaining[written:]
                    os.fsync(descriptor)
                finally:
                    os.close(descriptor)
                os.fsync(directory)
            finally:
                os.close(directory)
            return {
                "path": str(self.root.relative_to(packet.root) / name),
                "ordinal": ordinal,
                "byteLength": size,
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        except BaseException:
            packet.failed = True
            raise
        finally:
            self.busy = False
