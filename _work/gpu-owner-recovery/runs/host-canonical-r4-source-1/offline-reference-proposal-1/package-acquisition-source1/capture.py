# SPEC: _spec/runtime-protocol.puml
import base64
import gzip
import hashlib
import http.client
import io
import json
import os
from pathlib import Path
import select
import signal
import ssl
import stat
import struct
import subprocess
import sys
import tarfile
import threading
import time


D_REL = Path(
    "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1"
)
SOURCE_REL = D_REL / "package-acquisition-source1"
R_REL = D_REL / "package-acquisition-proposal-1"
LOCK_REL = D_REL / "local-inputs-1/inputs/reference/pnpm-lock.yaml"
RAW_REL = Path("_work/gpu-owner-recovery/cache/reference-package-inputs-1")
OUTPUT_REL = D_REL / "package-inputs-1"
OP_REL = R_REL / "acquisition-execution-1"
GRANT = "reference-two-package-source-acquisition-1"
PINS = {
    "request": "2eb3c9727f788f9c95f0f2650ee89bbd94a5eb5ed289db67d91226e978140b70",
    "plan": "8ecfce5156322da42fb852cd071a6091b96187e19a88226bec68295936505f6c",
    "approval": "62af17fc6199b5537c3488c10680b9269baf170a05a322facfdfad3737fea945",
    "lock": "1d05ed3d8de5a94873f26a2fb51b88c080704d2e90bf942f9f0bb2ce75a504e0",
}
CODE_FILES = ("capture.py", "test_capture.py", "verify.py")
ARCHIVE_CAP = 2 * 1024 * 1024
EXPANDED_CAP = 8 * 1024 * 1024
SELECTED_CAP = 8 * 1024 * 1024
HEADER_CAP = 256
FRAME_CAP = 4096
JOURNAL_CAP = 16384
RECEIPT_CAP = 65536
SECOND = 1_000_000_000
OP_NS = 120 * SECOND
WORK_NS = 110 * SECOND
GET_NS = 30 * SECOND
URLS = (
    "https://registry.npmjs.org/fflate/-/fflate-0.8.3.tgz",
    "https://registry.npmjs.org/jssha/-/jssha-3.3.2.tgz",
)


class Stop(Exception):
    pass


def require(condition, code):
    if not condition:
        raise Stop(code)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate-json-key")
        result[key] = value
    return result


def parse_json(data):
    try:
        return json.loads(
            data,
            object_pairs_hook=unique_object,
            parse_constant=lambda value: (_ for _ in ()).throw(Stop("nonfinite-json")),
        )
    except (ValueError, UnicodeError, RecursionError) as error:
        raise Stop("invalid-json") from error


def encoded(value, cap):
    data = (
        json.dumps(
            value,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
            allow_nan=False,
        )
        + "\n"
    ).encode("ascii")
    require(len(data) <= cap, "serialized-size-cap")
    return data


def check_time(now_ns, deadline_ns):
    require(now_ns() < deadline_ns, "absolute-deadline")


def safe_parents(path):
    for parent in reversed(path.absolute().parents):
        info = parent.lstat()
        require(
            stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode),
            "unsafe-parent",
        )


def read_regular(path, cap):
    safe_parents(path)
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        require(
            stat.S_ISREG(info.st_mode) and info.st_nlink == 1, "not-exclusive-regular"
        )
        require(info.st_size <= cap, "file-size-cap")
        chunks = []
        remaining = cap + 1
        while remaining:
            chunk = os.read(fd, min(65536, remaining))
            if not chunk:
                break
            chunks.append(chunk)
            remaining -= len(chunk)
        data = b"".join(chunks)
        require(len(data) <= cap and len(data) == info.st_size, "file-size-drift")
        after = os.fstat(fd)
        require(
            (info.st_size, info.st_mtime_ns, info.st_ctime_ns)
            == (after.st_size, after.st_mtime_ns, after.st_ctime_ns),
            "file-read-drift",
        )
        return data
    finally:
        os.close(fd)


def fsync_dir(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def write_exclusive(path, data, cap, *, created=lambda inode: None):
    require(len(data) <= cap, "file-size-cap")
    safe_parents(path)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(fd)
        require(
            stat.S_ISREG(info.st_mode) and info.st_nlink == 1, "created-file-identity"
        )
        created((info.st_dev, info.st_ino))
        view = memoryview(data)
        while view:
            amount = os.write(fd, view)
            require(amount > 0, "short-file-write")
            view = view[amount:]
        os.fsync(fd)
        info = os.fstat(fd)
    finally:
        os.close(fd)
    fsync_dir(path.parent)
    return (info.st_dev, info.st_ino)


def write_json(path, value, cap=RECEIPT_CAP, *, created=lambda inode: None):
    return write_exclusive(path, encoded(value, cap), cap, created=created)


def fresh_directory(path):
    safe_parents(path)
    os.mkdir(path, 0o700)
    fsync_dir(path.parent)


def source_hashes(source):
    return {
        name: sha256(read_regular(source / name, 256 * 1024)) for name in CODE_FILES
    }


def validate_documents(documents):
    require(set(documents) == set(PINS), "document-set")
    for key, expected in PINS.items():
        require(sha256(documents[key]) == expected, "pinned-" + key)
    request = parse_json(documents["request"])
    plan = parse_json(documents["plan"])
    approval = parse_json(documents["approval"])
    require(
        approval["grantId"] == GRANT
        and approval["status"] == "APPROVED_AT_ISSUANCE_NOT_EXECUTED",
        "inactive-approval",
    )
    require(
        approval["maximumCombinedAcquisitionAttempts"] == 1
        and approval["maximumGetRequests"] == 2
        and approval["maximumGetRequestsPerUrl"] == 1,
        "approval-caps",
    )
    require(tuple(item["url"] for item in plan["archives"]) == URLS, "url-set")
    require(
        plan["archiveRoot"] == str(RAW_REL)
        and plan["selectedSourcesRoot"] == str(OUTPUT_REL / "files"),
        "fixed-destinations",
    )
    require(
        request["requestedLimits"]
        == {
            "bytesPerArchive": ARCHIVE_CAP,
            "aggregateArchiveBytes": 2 * ARCHIVE_CAP,
            "perGetMs": 30000,
            "operationMs": 120000,
            "decompressedBytesPerArchiveIncludingSkippedContent": EXPANDED_CAP,
            "tarHeadersPerArchiveIncludingMetadata": HEADER_CAP,
            "aggregateSelectedOutputBytes": SELECTED_CAP,
            "selectedFiles": 6,
        },
        "limit-set",
    )
    for item in plan["archives"]:
        require(
            item["integrity"].encode("ascii") in documents["lock"], "lock-integrity"
        )
    return plan


def validate_ready(record, hashes, receipt_bytes, receipt_path):
    require(
        set(record)
        == {
            "version",
            "grantId",
            "sourceHashes",
            "mockVerificationReceipt",
            "bindings",
            "reviewStatuses",
            "nonAuthorizing",
        },
        "ready-schema",
    )
    require(
        record["version"] == "chess-coach.reference-package-implementation-ready.v1"
        and record["grantId"] == GRANT
        and record["nonAuthorizing"] is True,
        "ready-identity",
    )
    require(
        record["bindings"] == PINS and record["sourceHashes"] == hashes,
        "ready-bindings",
    )
    require(
        record["reviewStatuses"]
        == {"adversarial": "READY", "security": "READY", "devops": "READY"},
        "ready-reviews",
    )
    require(
        record["mockVerificationReceipt"]
        == {"path": str(receipt_path), "sha256": sha256(receipt_bytes)},
        "ready-proof",
    )
    receipt = parse_json(receipt_bytes)
    require(
        receipt["status"] == "PASS_MOCK_ONLY"
        and receipt["sourceHashes"] == hashes
        and receipt["bindings"] == PINS
        and receipt["unitTests"] > 0
        and receipt["negativeCases"] > 0
        and receipt["actualAcquisitionInvoked"] is False
        and receipt["actualWorkerInvoked"] is False
        and receipt["productionPathsTouched"] is False,
        "mock-receipt",
    )


def bootstrap(root):
    source = root / SOURCE_REL
    require(Path(__file__).absolute() == source / "capture.py", "fixed-source-location")
    documents = {
        key: read_regular(root / path, 8 * 1024 * 1024)
        for key, path in (
            ("request", R_REL / "request.json"),
            ("plan", R_REL / "plan.json"),
            ("approval", R_REL / "approval1.json"),
            ("lock", LOCK_REL),
        )
    }
    plan = validate_documents(documents)
    hashes = source_hashes(source)
    ready_bytes = read_regular(source / "implementation-ready-1.json", RECEIPT_CAP)
    ready = parse_json(ready_bytes)
    receipt_path = Path(ready["mockVerificationReceipt"]["path"])
    require(
        receipt_path.parent.parent == SOURCE_REL
        and receipt_path.name == "receipt.json"
        and receipt_path.parent.name.startswith("verification-"),
        "mock-proof-location",
    )
    suffix = receipt_path.parent.name.removeprefix("verification-")
    require(
        suffix.isascii()
        and suffix.isdigit()
        and str(int(suffix)) == suffix
        and 1 <= int(suffix) <= 99,
        "mock-proof-label",
    )
    receipt_bytes = read_regular(root / receipt_path, RECEIPT_CAP)
    validate_ready(ready, hashes, receipt_bytes, receipt_path)
    receipt = parse_json(receipt_bytes)
    manifest = read_regular(
        root / receipt_path.parent / "source-manifest.json", RECEIPT_CAP
    )
    require(
        sha256(manifest) == receipt["sourceManifestSha256"], "mock-manifest-binding"
    )
    require(
        parse_json(manifest) == {"sourceHashes": hashes, "bindings": PINS},
        "mock-manifest",
    )
    return {
        "plan": plan,
        "sourceHashes": hashes,
        "bindings": dict(PINS),
        "readySha256": sha256(ready_bytes),
        "mockReceiptSha256": sha256(receipt_bytes),
    }


class Journal:
    def __init__(self, path):
        self.path = path
        self.size = 0
        self.fd = os.open(
            path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600
        )
        fsync_dir(path.parent)

    def append(self, event):
        data = encoded(event, JOURNAL_CAP)
        require(self.size + len(data) <= JOURNAL_CAP, "journal-cap")
        view = memoryview(data)
        while view:
            amount = os.write(self.fd, view)
            require(amount > 0, "journal-write")
            self.size += amount
            view = view[amount:]
        os.fsync(self.fd)

    def close(self):
        if self.fd is not None:
            os.close(self.fd)
            self.fd = None


def claim_attempt(path, identity, *, now_ns=time.monotonic_ns):
    origin = now_ns()
    fresh_directory(path)
    attempt_id = "reference-two-" + str(origin) + "-" + str(os.getpid())
    marker = {
        "grantId": GRANT,
        "attemptId": attempt_id,
        "originMonoNs": origin,
        "operationDeadlineMonoNs": origin + OP_NS,
        "workCutoffMonoNs": origin + WORK_NS,
        "combinedAttemptsConsumed": 1,
        "remainingCombinedAttempts": 0,
        "automaticRetryAuthorized": False,
        "identity": identity,
    }
    write_json(path / "attempt.json", marker, JOURNAL_CAP)
    journal = Journal(path / "events.jsonl")
    journal.append(
        {
            "type": "COMBINED_CLAIMED",
            "attemptId": attempt_id,
            "combinedAttemptsConsumed": 1,
            "remainingCombinedAttempts": 0,
        }
    )
    return marker, journal


class FrameChannel:
    def __init__(
        self,
        read_fd,
        write_fd,
        *,
        now_ns=time.monotonic_ns,
        read=os.read,
        write=os.write,
        wait=select.select,
        alive=lambda: None,
    ):
        self.read_fd = read_fd
        self.write_fd = write_fd
        self.now_ns = now_ns
        self.read = read
        self.write = write
        self.wait = wait
        self.alive = alive

    def ready(self, writing, deadline):
        while True:
            self.alive()
            check_time(self.now_ns, deadline)
            seconds = min(0.1, (deadline - self.now_ns()) / SECOND)
            require(seconds > 0, "absolute-deadline")
            readable, writable, exceptional = self.wait(
                [] if writing else [self.read_fd],
                [self.write_fd] if writing else [],
                [],
                seconds,
            )
            require(not exceptional, "pipe-exception")
            check_time(self.now_ns, deadline)
            if writable if writing else readable:
                return

    def send(self, value, deadline):
        payload = encoded(value, FRAME_CAP)
        view = memoryview(struct.pack("!I", len(payload)) + payload)
        while view:
            self.ready(True, deadline)
            try:
                amount = self.write(self.write_fd, view)
            except BlockingIOError:
                continue
            require(amount > 0, "pipe-short-write")
            view = view[amount:]
        check_time(self.now_ns, deadline)

    def receive(self, deadline):
        header = bytearray()
        while len(header) < 4:
            self.ready(False, deadline)
            try:
                data = self.read(self.read_fd, 4 - len(header))
            except BlockingIOError:
                continue
            if not data:
                if not header:
                    raise EOFError("pipe-eof")
                raise Stop("truncated-frame-header")
            require(len(data) <= 4 - len(header), "pipe-read-overrun")
            header.extend(data)
        length = struct.unpack("!I", header)[0]
        require(0 < length <= FRAME_CAP, "frame-length-cap")
        payload = bytearray()
        while len(payload) < length:
            self.ready(False, deadline)
            try:
                data = self.read(self.read_fd, length - len(payload))
            except BlockingIOError:
                continue
            require(bool(data), "truncated-frame-payload")
            require(len(data) <= length - len(payload), "pipe-read-overrun")
            payload.extend(data)
        check_time(self.now_ns, deadline)
        value = parse_json(payload)
        require(isinstance(value, dict), "frame-object")
        return value


class Protocol:
    def __init__(
        self, marker, journal, *, now_ns=time.monotonic_ns, allowed_artifacts=()
    ):
        self.marker = marker
        self.journal = journal
        self.now_ns = now_ns
        self.starts = []
        self.issued = set()
        self.completed = {}
        self.allowed_artifacts = frozenset(allowed_artifacts)
        self.artifacts = {}
        self.done = None
        self.deadline = marker["workCutoffMonoNs"]

    def accept(self, frame):
        check_time(self.now_ns, self.deadline)
        require(self.done is None, "frame-after-done")
        require(frame.get("attemptId") == self.marker["attemptId"], "attempt-identity")
        kind = frame.get("type")
        if kind == "URL_START":
            require(
                set(frame) == {"type", "attemptId", "seq", "urlIndex"}, "start-schema"
            )
            index = frame["urlIndex"]
            require(
                type(index) is int
                and type(frame["seq"]) is int
                and index == len(self.starts)
                and index in (0, 1)
                and frame["seq"] == index + 1,
                "url-order-or-cap",
            )
            require(
                index == 0 or index - 1 in self.completed, "unfinished-previous-url"
            )
            accepted_ns = self.now_ns()
            get_deadline = min(accepted_ns + GET_NS, self.marker["workCutoffMonoNs"])
            self.starts.append(index)
            self.deadline = get_deadline
            self.journal.append(
                {
                    "type": "URL_START_CONSUMED",
                    "attemptId": frame["attemptId"],
                    "seq": frame["seq"],
                    "urlIndex": index,
                    "acceptedMonoNs": accepted_ns,
                    "getDeadlineMonoNs": get_deadline,
                }
            )
            check_time(self.now_ns, get_deadline)
            return {
                "type": "ACK",
                "attemptId": frame["attemptId"],
                "seq": frame["seq"],
                "getDeadlineMonoNs": get_deadline,
                "operationDeadlineMonoNs": self.marker["operationDeadlineMonoNs"],
            }
        if kind in ("GET_ISSUED", "RESPONSE_COMPLETED"):
            keys = {"type", "attemptId", "seq", "urlIndex"}
            if kind == "RESPONSE_COMPLETED":
                keys |= {"bytes", "sha256", "sha512"}
            require(
                set(frame) == keys
                and type(frame["seq"]) is int
                and type(frame["urlIndex"]) is int
                and bool(self.starts)
                and frame["urlIndex"] == self.starts[-1]
                and frame["seq"] == self.starts[-1] + 1,
                "event-order",
            )
            index = frame["urlIndex"]
            if kind == "GET_ISSUED":
                require(index not in self.issued, "duplicate-issued")
                self.issued.add(index)
            else:
                require(
                    index in self.issued and index not in self.completed,
                    "completion-order",
                )
                require(
                    type(frame["bytes"]) is int and 0 <= frame["bytes"] <= ARCHIVE_CAP,
                    "response-byte-cap",
                )
                for key, length in (("sha256", 64), ("sha512", 128)):
                    value = frame[key]
                    require(
                        isinstance(value, str)
                        and len(value) == length
                        and all(c in "0123456789abcdef" for c in value),
                        "response-hash",
                    )
                self.completed[index] = dict(frame)
                self.deadline = self.marker["workCutoffMonoNs"]
            self.journal.append(frame)
            return None
        if kind == "ARTIFACT_CREATED":
            require(
                set(frame)
                == {"type", "attemptId", "ordinal", "path", "device", "inode"}
                and len(self.completed) == 2
                and type(frame["ordinal"]) is int
                and frame["ordinal"] == len(self.artifacts) + 1
                and len(self.artifacts) < 7,
                "artifact-event-order",
            )
            name = frame["path"]
            require(
                isinstance(name, str)
                and name in self.allowed_artifacts
                and name not in self.artifacts
                and (bool(self.artifacts) or name == "selected-input-manifest.json")
                and type(frame["device"]) is int
                and frame["device"] >= 0
                and type(frame["inode"]) is int
                and frame["inode"] > 0,
                "artifact-event-identity",
            )
            self.artifacts[name] = (frame["device"], frame["inode"])
            self.journal.append(frame)
            return None
        if kind == "DONE":
            require(
                set(frame) == {"type", "attemptId", "seq", "manifestSha256"}
                and type(frame["seq"]) is int
                and frame["seq"] == 3
                and len(self.completed) == 2
                and len(self.issued) == 2
                and isinstance(frame["manifestSha256"], str)
                and len(frame["manifestSha256"]) == 64
                and all(c in "0123456789abcdef" for c in frame["manifestSha256"]),
                "done-evidence",
            )
            require(
                not self.allowed_artifacts or 5 <= len(self.artifacts) <= 7,
                "done-owned-artifacts",
            )
            self.journal.append(frame)
            self.done = frame
            return None
        if kind == "FAIL":
            require(
                set(frame) == {"type", "attemptId", "code"}
                and isinstance(frame["code"], str)
                and len(frame["code"]) <= 128,
                "fail-schema",
            )
            self.journal.append(frame)
            raise Stop("worker-reported-" + frame["code"])
        raise Stop("unknown-worker-frame")

    def facts(self):
        return {
            "combinedAttemptsConsumed": 1,
            "remainingCombinedAttempts": 0,
            "urlStartsConsumed": len(self.starts),
            "remainingGetSlots": 2 - len(self.starts),
            "getRequestsIssued": len(self.issued)
            if len(self.issued) == len(self.starts)
            else None,
            "confirmedGetRequestsIssued": len(self.issued),
            "responsesCompleted": len(self.completed),
            "automaticRetryAuthorized": False,
            "unusedGetSlotsRenewCombinedAllowance": False,
        }


class HTTPSExchange:
    def __init__(self, spec, *, now_ns):
        require(spec["url"] in URLS, "fixed-https-url")
        self.path = spec["url"].removeprefix("https://registry.npmjs.org")
        self.now_ns = now_ns
        self.connection = None
        self.response = None
        self.stream_socket = None

    def timeout(self, deadline):
        check_time(self.now_ns, deadline)
        remaining = (deadline - self.now_ns()) / SECOND
        require(remaining > 0, "absolute-deadline")
        if self.connection is not None:
            self.connection.timeout = remaining
            if self.stream_socket is not None:
                self.stream_socket.settimeout(remaining)
        return remaining

    def connect(self, deadline):
        self.connection = http.client.HTTPSConnection(
            "registry.npmjs.org",
            443,
            timeout=self.timeout(deadline),
            context=ssl.create_default_context(),
        )
        self.connection.connect()
        self.stream_socket = self.connection.sock
        self.connection.auto_open = 0

    def issue_get(self, deadline):
        self.timeout(deadline)
        self.connection.request(
            "GET",
            self.path,
            headers={"Accept-Encoding": "identity", "Connection": "close"},
        )

    def headers(self, deadline):
        self.timeout(deadline)
        self.response = self.connection.getresponse()
        return self.response.status, self.response.getheader("Content-Encoding")

    def read(self, limit, deadline):
        self.timeout(deadline)
        return self.response.read1(limit)

    def close(self):
        if self.connection is not None:
            self.connection.close()


def real_open_https(spec, *, now_ns):
    return HTTPSExchange(spec, now_ns=now_ns)


class Downloader:
    def __init__(self, *, open_https, now_ns):
        require(callable(open_https), "open-https-must-be-callable")
        require(callable(now_ns), "clock-must-be-callable")
        self.open_https = open_https
        self.now_ns = now_ns

    def download(
        self,
        spec,
        sink,
        *,
        get_deadline_ns,
        operation_deadline_ns,
        progress=lambda kind, facts: None,
        alive=lambda: None,
    ):
        deadline = min(get_deadline_ns, operation_deadline_ns)
        exchange = None
        count = 0
        digest512 = hashlib.sha512()
        digest256 = hashlib.sha256()

        def active():
            alive()
            check_time(self.now_ns, deadline)

        try:
            active()
            exchange = self.open_https(spec, now_ns=self.now_ns)
            active()
            exchange.connect(deadline)
            active()
            exchange.issue_get(deadline)
            active()
            progress("GET_ISSUED", {})
            active()
            status, content_encoding = exchange.headers(deadline)
            active()
            require(type(status) is int and status == 200, "http-status-not-200")
            require(
                content_encoding is None
                or content_encoding.lower().strip() == "identity",
                "unexpected-http-content-encoding",
            )
            while True:
                active()
                limit = min(65536, ARCHIVE_CAP - count + 1)
                chunk = exchange.read(limit, deadline)
                active()
                require(
                    isinstance(chunk, bytes) and len(chunk) <= limit,
                    "transport-byte-contract",
                )
                if not chunk:
                    break
                accepted = chunk[: max(0, ARCHIVE_CAP - count)]
                view = memoryview(accepted)
                while view:
                    active()
                    amount = sink.write(view)
                    require(
                        type(amount) is int and 0 < amount <= len(view),
                        "short-archive-write",
                    )
                    view = view[amount:]
                digest512.update(accepted)
                digest256.update(accepted)
                count += len(chunk)
                require(count <= ARCHIVE_CAP, "archive-byte-cap")
            facts = {
                "bytes": count,
                "sha256": digest256.hexdigest(),
                "sha512": digest512.hexdigest(),
            }
            progress("RESPONSE_COMPLETED", facts)
            active()
            expected = "sha512-" + base64.b64encode(digest512.digest()).decode("ascii")
            require(expected == spec["integrity"], "archive-sri-mismatch")
            return facts
        finally:
            if exchange is not None:
                exchange.close()


def download_archive(
    spec,
    sink,
    *,
    now_ns,
    open_https,
    get_deadline_ns,
    operation_deadline_ns,
    progress=lambda kind, facts: None,
    alive=lambda: None,
):
    downloader = Downloader(open_https=open_https, now_ns=now_ns)
    return downloader.download(
        spec,
        sink,
        get_deadline_ns=get_deadline_ns,
        operation_deadline_ns=operation_deadline_ns,
        progress=progress,
        alive=alive,
    )


def inspect_verified_archive(raw, spec):
    require(len(raw) <= ARCHIVE_CAP, "archive-byte-cap")
    integrity = "sha512-" + base64.b64encode(hashlib.sha512(raw).digest()).decode(
        "ascii"
    )
    require(integrity == spec["integrity"], "archive-sri-before-inflate")
    try:
        with gzip.GzipFile(fileobj=io.BytesIO(raw), mode="rb") as compressed:
            tar_bytes = compressed.read(EXPANDED_CAP + 1)
    except (OSError, EOFError, ValueError) as error:
        raise Stop("invalid-gzip") from error
    require(len(tar_bytes) <= EXPANDED_CAP, "expanded-work-cap")
    require(len(tar_bytes) % 512 == 0, "tar-block-size")
    candidates = {entry["member"] for entry in spec["requiredMembers"]}
    candidates.update(spec["optionalLicenseMembersInPreferenceOrder"])
    physical = {}
    selected_physical = {}
    offset = 0
    headers = 0
    ended = False
    while offset < len(tar_bytes):
        block = tar_bytes[offset : offset + 512]
        if block == b"\0" * 512:
            require(
                tar_bytes[offset : offset + 1024] == b"\0" * 1024
                and not any(tar_bytes[offset:]),
                "tar-terminator",
            )
            ended = True
            break
        headers += 1
        require(headers <= HEADER_CAP, "physical-tar-header-cap")
        try:
            info = tarfile.TarInfo.frombuf(block, "utf-8", "strict")
        except (tarfile.TarError, ValueError, UnicodeError) as error:
            raise Stop("physical-tar-header") from error
        require(type(info.size) is int and info.size >= 0, "physical-tar-size")
        require(info.type != tarfile.GNUTYPE_SPARSE, "physical-sparse")
        data_offset = offset + 512
        next_offset = data_offset + ((info.size + 511) // 512) * 512
        require(next_offset <= len(tar_bytes), "physical-tar-bounds")
        physical[data_offset] = info
        if info.name in candidates:
            require(info.name not in selected_physical, "physical-selected-duplicate")
            require(
                info.type in (tarfile.REGTYPE, tarfile.AREGTYPE),
                "physical-selected-not-regular",
            )
            selected_physical[info.name] = (data_offset, info.size)
        offset = next_offset
    require(ended, "missing-tar-terminator")
    logical = {}
    try:
        with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:") as archive:
            for member in archive:
                require(
                    not member.sparse
                    and not any(
                        key.startswith("GNU.sparse") for key in member.pax_headers
                    ),
                    "logical-sparse",
                )
                if member.name not in candidates:
                    continue
                require(member.name not in logical, "logical-selected-duplicate")
                require(
                    member.type in (tarfile.REGTYPE, tarfile.AREGTYPE)
                    and member.isreg(),
                    "logical-selected-not-regular",
                )
                header = physical.get(member.offset_data)
                require(
                    header is not None
                    and header.name == member.name
                    and header.size == member.size
                    and selected_physical.get(member.name)
                    == (member.offset_data, member.size),
                    "physical-logical-selected-disagreement",
                )
                require(member.size <= SELECTED_CAP, "selected-member-cap")
                payload = archive.extractfile(member)
                require(payload is not None, "selected-extractfile")
                with payload:
                    data = payload.read(member.size + 1)
                require(len(data) == member.size, "selected-size-disagreement")
                logical[member.name] = data
    except (tarfile.TarError, OSError, ValueError, UnicodeError) as error:
        raise Stop("logical-tar-invalid") from error
    require(
        set(logical) == set(selected_physical), "physical-selected-hidden-by-metadata"
    )
    result = []
    for entry in spec["requiredMembers"]:
        require(entry["member"] in logical, "missing-required-member")
        result.append({**entry, "data": logical[entry["member"]], "license": False})
    package_json = parse_json(logical["package/package.json"])
    require(
        isinstance(package_json, dict)
        and package_json.get("name") == spec["name"]
        and package_json.get("version") == spec["version"],
        "package-identity",
    )
    license_member = next(
        (
            name
            for name in spec["optionalLicenseMembersInPreferenceOrder"]
            if name in logical
        ),
        None,
    )
    if license_member is not None:
        result.append(
            {
                "member": license_member,
                "retainedFile": spec["licenseRetainedFilePrefix"]
                + license_member.rsplit("/", 1)[1],
                "data": logical[license_member],
                "license": True,
            }
        )
    require(
        len(result) <= 3 and sum(len(item["data"]) for item in result) <= SELECTED_CAP,
        "selected-archive-cap",
    )
    return {
        "files": result,
        "licenseMember": license_member,
        "legalClearance": False,
        "expandedBytesIncludingSkippedContent": len(tar_bytes),
        "physicalTarHeaders": headers,
    }


def selected_manifest(inspections, plan, identity, attempt_id):
    require(len(inspections) == 2, "inspection-count")
    files = []
    packages = []
    for spec, inspection in zip(plan["archives"], inspections):
        packages.append(
            {
                "name": spec["name"],
                "version": spec["version"],
                "licenseMember": inspection["licenseMember"],
                "legalClearance": False,
                "expandedBytesIncludingSkippedContent": inspection[
                    "expandedBytesIncludingSkippedContent"
                ],
                "physicalTarHeaders": inspection["physicalTarHeaders"],
            }
        )
        for entry in inspection["files"]:
            item = {key: value for key, value in entry.items() if key != "data"}
            item.update(
                {
                    "package": spec["name"],
                    "bytes": len(entry["data"]),
                    "sha256": sha256(entry["data"]),
                }
            )
            name = item["retainedFile"]
            require(
                isinstance(name, str)
                and name not in ("", ".", "..")
                and Path(name).name == name
                and "/" not in name
                and "\\" not in name,
                "flat-selected-name",
            )
            files.append(item)
    require(
        len(files) <= 6
        and len({item["retainedFile"] for item in files}) == len(files)
        and sum(item["bytes"] for item in files) <= SELECTED_CAP,
        "aggregate-selected-cap",
    )
    return {
        "version": "chess-coach.reference-selected-inputs.v1",
        "attemptId": attempt_id,
        "identity": identity,
        "files": files,
        "packages": packages,
        "legalClearance": False,
        "assembledSourceRoot": False,
        "packageCodeExecuted": False,
        "trainingReady": False,
    }


def persist_selected(
    output,
    inspections,
    manifest,
    *,
    active=lambda: None,
    created=lambda name, inode: None,
):
    active()
    manifest_path = output / "selected-input-manifest.json"
    write_json(
        manifest_path,
        manifest,
        created=lambda inode: created("selected-input-manifest.json", inode),
    )
    for inspection in inspections:
        for entry in inspection["files"]:
            active()
            write_exclusive(
                output / "files" / entry["retainedFile"],
                entry["data"],
                SELECTED_CAP,
                created=lambda inode: created("files/" + entry["retainedFile"], inode),
            )
            active()
    return sha256(read_regular(manifest_path, RECEIPT_CAP))


def validate_selected(
    output, plan, identity, attempt_id, manifest_hash, *, active=lambda: None
):
    active()
    data = read_regular(output / "selected-input-manifest.json", RECEIPT_CAP)
    require(sha256(data) == manifest_hash, "selected-manifest-hash")
    manifest = parse_json(data)
    require(
        set(manifest)
        == {
            "version",
            "attemptId",
            "identity",
            "files",
            "packages",
            "legalClearance",
            "assembledSourceRoot",
            "packageCodeExecuted",
            "trainingReady",
        }
        and manifest["version"] == "chess-coach.reference-selected-inputs.v1"
        and manifest["attemptId"] == attempt_id
        and manifest["identity"] == identity
        and manifest["legalClearance"] is False
        and manifest["assembledSourceRoot"] is False
        and manifest["packageCodeExecuted"] is False
        and manifest["trainingReady"] is False,
        "selected-manifest-identity",
    )
    require(
        isinstance(manifest["files"], list)
        and len(manifest["files"]) <= 6
        and isinstance(manifest["packages"], list)
        and len(manifest["packages"]) == 2,
        "selected-manifest-count",
    )
    expected_files = []
    for spec, package in zip(plan["archives"], manifest["packages"]):
        require(
            set(package)
            == {
                "name",
                "version",
                "licenseMember",
                "legalClearance",
                "expandedBytesIncludingSkippedContent",
                "physicalTarHeaders",
            }
            and package["name"] == spec["name"]
            and package["version"] == spec["version"]
            and package["legalClearance"] is False
            and type(package["expandedBytesIncludingSkippedContent"]) is int
            and 0 <= package["expandedBytesIncludingSkippedContent"] <= EXPANDED_CAP
            and type(package["physicalTarHeaders"]) is int
            and 0 < package["physicalTarHeaders"] <= HEADER_CAP,
            "selected-package-metadata",
        )
        expected_files.extend(
            {**entry, "package": spec["name"], "license": False}
            for entry in spec["requiredMembers"]
        )
        license_member = package["licenseMember"]
        require(
            license_member is None
            or license_member in spec["optionalLicenseMembersInPreferenceOrder"],
            "selected-license-member",
        )
        if license_member is not None:
            expected_files.append(
                {
                    "member": license_member,
                    "package": spec["name"],
                    "license": True,
                    "retainedFile": spec["licenseRetainedFilePrefix"]
                    + license_member.rsplit("/", 1)[1],
                }
            )
    require(len(manifest["files"]) == len(expected_files), "selected-files-count")
    total = 0
    for actual, expected in zip(manifest["files"], expected_files):
        require(
            set(actual) == set(expected) | {"bytes", "sha256"}
            and all(actual[key] == value for key, value in expected.items()),
            "selected-file-mapping",
        )
        require(
            type(actual["bytes"]) is int and 0 <= actual["bytes"] <= SELECTED_CAP,
            "selected-file-size",
        )
        total += actual["bytes"]
        require(total <= SELECTED_CAP, "aggregate-selected-cap")
        active()
        payload = read_regular(
            output / "files" / actual["retainedFile"], actual["bytes"]
        )
        require(
            len(payload) == actual["bytes"] and sha256(payload) == actual["sha256"],
            "selected-file-hash",
        )
        if actual["member"] == "package/package.json":
            document = parse_json(payload)
            spec = next(
                item for item in plan["archives"] if item["name"] == actual["package"]
            )
            require(
                document.get("name") == spec["name"]
                and document.get("version") == spec["version"],
                "retained-package-identity",
            )
        active()
    require(
        set(os.listdir(output / "files"))
        == {item["retainedFile"] for item in expected_files},
        "unexpected-output-file",
    )
    active()
    return manifest


def prepare_paths(root, plan, owned):
    ignore = read_regular(root / ".gitignore", 65536).decode("utf-8")
    lines = [line.strip() for line in ignore.splitlines()]
    require(
        "/_work/gpu-owner-recovery/cache/" in lines
        and not any(
            line.startswith("!")
            for line in lines[lines.index("/_work/gpu-owner-recovery/cache/") + 1 :]
        ),
        "raw-ignore-rule",
    )
    for relative in (
        Path("_work"),
        Path("_work/gpu-owner-recovery"),
        Path("_work/gpu-owner-recovery/cache"),
    ):
        candidate = root / relative / ".gitignore"
        if os.path.lexists(candidate):
            require(
                not any(
                    line.strip().startswith("!")
                    for line in read_regular(candidate, 65536)
                    .decode("utf-8")
                    .splitlines()
                ),
                "nested-unignore",
            )
    raw = root / RAW_REL
    output = root / OUTPUT_REL
    require(
        not os.path.lexists(raw) and not os.path.lexists(output),
        "operation-root-not-fresh",
    )
    fresh_directory(raw)
    owned["rawRoot"] = True
    fresh_directory(output)
    owned["outputRoot"] = True
    fresh_directory(output / "files")
    for spec in plan["archives"]:
        path = raw / spec["archiveFile"]
        owned["rawFiles"][spec["archiveFile"]] = write_exclusive(path, b"", ARCHIVE_CAP)


def artifact_names(plan):
    names = {"selected-input-manifest.json"}
    for spec in plan["archives"]:
        names.update(
            "files/" + entry["retainedFile"] for entry in spec["requiredMembers"]
        )
        names.update(
            "files/" + spec["licenseRetainedFilePrefix"] + member.rsplit("/", 1)[1]
            for member in spec["optionalLicenseMembersInPreferenceOrder"]
        )
    return names


def owned_partials(root, plan, owned, *, now_ns, deadline_ns):
    artifacts = []
    candidates = []
    for name, inode in owned["rawFiles"].items():
        candidates.append((root / RAW_REL / name, ARCHIVE_CAP, inode))
    if owned.get("outputRoot"):
        for name, inode in owned.get("selectedFiles", {}).items():
            require(name in artifact_names(plan), "partial-selected-name")
            candidates.append(
                (
                    root / OUTPUT_REL / name,
                    RECEIPT_CAP
                    if name == "selected-input-manifest.json"
                    else SELECTED_CAP,
                    inode,
                )
            )
    budget = 2 * ARCHIVE_CAP + SELECTED_CAP + RECEIPT_CAP
    for path, cap, inode in candidates:
        if now_ns() >= deadline_ns:
            artifacts.append(
                {
                    "path": str(path.relative_to(root)),
                    "inspection": "deadline-not-inspected",
                }
            )
            continue
        try:
            info = path.lstat()
            require(
                stat.S_ISREG(info.st_mode)
                and info.st_nlink == 1
                and inode == (info.st_dev, info.st_ino),
                "partial-identity",
            )
            require(info.st_size <= min(cap, budget), "partial-cap")
            data = read_regular(path, min(cap, budget))
            budget -= len(data)
            artifacts.append(
                {
                    "path": str(path.relative_to(root)),
                    "bytes": len(data),
                    "sha256": sha256(data),
                    "empty": not data,
                }
            )
        except FileNotFoundError:
            continue
        except (Stop, OSError) as error:
            artifacts.append(
                {
                    "path": str(path.relative_to(root)),
                    "inspection": type(error).__name__,
                }
            )
    return artifacts


def cleanup_worker(process, *, now_ns, deadline_ns, killpg=os.killpg):
    facts = {
        "workerReaped": False,
        "workerExitCode": None,
        "termSent": False,
        "killSent": False,
        "reapingUnresolved": False,
    }
    if process is None:
        return facts
    code = process.poll()
    if code is None:
        for sig, key, seconds in (
            (signal.SIGTERM, "termSent", 2),
            (signal.SIGKILL, "killSent", 4),
        ):
            if now_ns() >= deadline_ns:
                break
            try:
                killpg(process.pid, sig)
                facts[key] = True
            except ProcessLookupError:
                pass
            try:
                remaining = max(0, (deadline_ns - now_ns()) / SECOND)
                if remaining > 0:
                    code = process.wait(timeout=min(seconds, remaining))
            except subprocess.TimeoutExpired:
                code = process.poll()
            if code is not None:
                break
    facts.update(
        {
            "workerReaped": code is not None,
            "workerExitCode": code,
            "reapingUnresolved": code is None,
        }
    )
    return facts


def supervise_worker(
    process,
    channel,
    protocol,
    *,
    validate_done,
    current_bindings,
    now_ns=time.monotonic_ns,
):
    while True:
        try:
            frame = channel.receive(protocol.deadline)
        except EOFError:
            break
        ack = protocol.accept(frame)
        if ack is not None:
            channel.send(ack, protocol.deadline)
    require(protocol.done is not None, "worker-eof-without-done")
    check_time(now_ns, protocol.marker["workCutoffMonoNs"])
    remaining = (protocol.marker["workCutoffMonoNs"] - now_ns()) / SECOND
    require(remaining > 0, "absolute-deadline")
    try:
        code = process.wait(timeout=remaining)
    except subprocess.TimeoutExpired as error:
        raise Stop("worker-exit-deadline") from error
    require(code == 0, "worker-nonzero-exit")
    check_time(now_ns, protocol.marker["workCutoffMonoNs"])
    validate_done(protocol.done)
    check_time(now_ns, protocol.marker["workCutoffMonoNs"])
    current_bindings()
    check_time(now_ns, protocol.marker["workCutoffMonoNs"])


def execute_approved():
    root = Path(__file__).absolute().parents[6]
    identity = bootstrap(root)
    marker, journal = claim_attempt(root / OP_REL, identity)
    protocol = Protocol(
        marker, journal, allowed_artifacts=artifact_names(identity["plan"])
    )
    owned = {"rawRoot": False, "outputRoot": False, "rawFiles": {}}
    process = None
    terminal = "FAIL"
    failure = None
    cleanup = None
    previous_signals = {}

    def interrupted(signum, frame):
        raise Stop("supervisor-interrupted-" + str(signum))

    try:
        for signum in (signal.SIGTERM, signal.SIGHUP):
            previous_signals[signum] = signal.signal(signum, interrupted)
        check_time(time.monotonic_ns, marker["workCutoffMonoNs"])
        require(bootstrap(root) == identity, "preflight-binding-drift")
        prepare_paths(root, identity["plan"], owned)
        check_time(time.monotonic_ns, marker["workCutoffMonoNs"])
        process = subprocess.Popen(
            [
                sys.executable,
                "-I",
                "-S",
                "-B",
                str(root / SOURCE_REL / "capture.py"),
                "--worker",
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            shell=False,
            close_fds=True,
            start_new_session=True,
            bufsize=0,
            cwd=root,
            env={"LC_ALL": "C", "LANG": "C"},
        )
        os.set_blocking(process.stdin.fileno(), False)
        os.set_blocking(process.stdout.fileno(), False)
        channel = FrameChannel(process.stdout.fileno(), process.stdin.fileno())
        channel.send(
            {
                "type": "CONFIG",
                "attemptId": marker["attemptId"],
                "originMonoNs": marker["originMonoNs"],
                "operationDeadlineMonoNs": marker["operationDeadlineMonoNs"],
                "workCutoffMonoNs": marker["workCutoffMonoNs"],
                "readySha256": identity["readySha256"],
                "rawIdentities": {
                    name: list(inode) for name, inode in owned["rawFiles"].items()
                },
            },
            marker["workCutoffMonoNs"],
        )

        def active():
            check_time(time.monotonic_ns, marker["workCutoffMonoNs"])

        def validate_done(frame):
            for index, spec in enumerate(identity["plan"]["archives"]):
                active()
                raw_path = root / RAW_REL / spec["archiveFile"]
                info = raw_path.lstat()
                require(
                    (info.st_dev, info.st_ino)
                    == owned["rawFiles"][spec["archiveFile"]],
                    "final-raw-identity",
                )
                data = read_regular(raw_path, ARCHIVE_CAP)
                completed = protocol.completed[index]
                require(
                    len(data) == completed["bytes"]
                    and sha256(data) == completed["sha256"]
                    and hashlib.sha512(data).hexdigest() == completed["sha512"]
                    and "sha512-"
                    + base64.b64encode(hashlib.sha512(data).digest()).decode("ascii")
                    == spec["integrity"],
                    "final-raw-binding",
                )
            validate_selected(
                root / OUTPUT_REL,
                identity["plan"],
                identity,
                marker["attemptId"],
                frame["manifestSha256"],
                active=active,
            )

        def current_bindings():
            require(bootstrap(root) == identity, "completion-binding-drift")

        supervise_worker(
            process,
            channel,
            protocol,
            validate_done=validate_done,
            current_bindings=current_bindings,
        )
        terminal = "PASS"
    except (Exception, KeyboardInterrupt) as error:
        failure = str(error)[:256] if isinstance(error, Stop) else type(error).__name__
    finally:
        previous_signals.setdefault(signal.SIGINT, signal.getsignal(signal.SIGINT))
        for signum in previous_signals:
            signal.signal(signum, signal.SIG_IGN)
        cleanup = cleanup_worker(
            process,
            now_ns=time.monotonic_ns,
            deadline_ns=marker["operationDeadlineMonoNs"] - 2 * SECOND,
        )
        if process is not None:
            for pipe in (process.stdin, process.stdout):
                if pipe is not None:
                    pipe.close()
        if not cleanup["workerReaped"] or cleanup["workerExitCode"] != 0:
            terminal = "FAIL"
        owned["selectedFiles"] = protocol.artifacts
        partials = owned_partials(
            root,
            identity["plan"],
            owned,
            now_ns=time.monotonic_ns,
            deadline_ns=marker["operationDeadlineMonoNs"] - SECOND,
        )
        observed = time.monotonic_ns()
        if observed >= marker["operationDeadlineMonoNs"]:
            terminal = "FAIL"
            failure = failure or "observed-operation-overrun"
        receipt = {
            "version": "chess-coach.reference-package-acquisition-receipt.v1",
            "grantId": GRANT,
            "attemptId": marker["attemptId"],
            "identity": identity,
            "terminalState": terminal,
            "failure": failure,
            **protocol.facts(),
            **cleanup,
            "doneEvidenceReceived": protocol.done is not None,
            "partialArtifacts": partials,
            "originMonoNs": marker["originMonoNs"],
            "operationDeadlineMonoNs": marker["operationDeadlineMonoNs"],
            "receiptPreparationMonoNs": observed,
            "observedOperationOverrunAtReceiptPreparation": observed
            >= marker["operationDeadlineMonoNs"],
            "strictOsSchedulingOrReceiptDurabilityDeadlineGuarantee": False,
            "capsAreFitOrQuotaGuarantees": False,
            "trainingReady": False,
        }
        try:
            journal.append(
                {
                    "type": "TERMINAL",
                    "terminalState": terminal,
                    "combinedAttemptsConsumed": 1,
                    "remainingCombinedAttempts": 0,
                    "workerReaped": cleanup["workerReaped"],
                }
            )
            write_json(root / OP_REL / "receipt.json", receipt)
        finally:
            journal.close()
            for signum, previous in previous_signals.items():
                signal.signal(signum, previous)
    return (
        0
        if terminal == "PASS"
        and time.monotonic_ns() < marker["operationDeadlineMonoNs"]
        else 1
    )


def parent_guard(fd):
    readable, _, _ = select.select([fd], [], [], 0)
    if readable:
        data = os.read(fd, 1)
        raise Stop("parent-eof" if not data else "unexpected-parent-data")


def watch_parent(fd, deadline):
    poller = select.poll()
    poller.register(fd, select.POLLHUP | select.POLLERR | select.POLLNVAL)
    while time.monotonic_ns() < deadline:
        events = poller.poll(100)
        if any(
            flags & (select.POLLHUP | select.POLLERR | select.POLLNVAL)
            for _, flags in events
        ):
            os._exit(79)
    os._exit(80)


def worker_main():
    root = Path(__file__).absolute().parents[6]
    read_fd, write_fd = sys.stdin.fileno(), sys.stdout.fileno()
    os.set_blocking(read_fd, False)
    os.set_blocking(write_fd, False)
    channel = FrameChannel(read_fd, write_fd)
    config = channel.receive(time.monotonic_ns() + 5 * SECOND)
    require(
        set(config)
        == {
            "type",
            "attemptId",
            "originMonoNs",
            "operationDeadlineMonoNs",
            "workCutoffMonoNs",
            "readySha256",
            "rawIdentities",
        }
        and config["type"] == "CONFIG",
        "config-schema",
    )
    require(
        type(config["originMonoNs"]) is int
        and config["operationDeadlineMonoNs"] == config["originMonoNs"] + OP_NS
        and config["workCutoffMonoNs"] == config["originMonoNs"] + WORK_NS,
        "config-deadlines",
    )
    check_time(time.monotonic_ns, config["workCutoffMonoNs"])
    threading.Thread(
        target=watch_parent, args=(read_fd, config["workCutoffMonoNs"]), daemon=True
    ).start()
    identity = bootstrap(root)
    require(identity["readySha256"] == config["readySha256"], "worker-ready-binding")
    marker = parse_json(read_regular(root / OP_REL / "attempt.json", JOURNAL_CAP))
    require(
        marker["attemptId"] == config["attemptId"]
        and marker["identity"] == identity
        and marker["originMonoNs"] == config["originMonoNs"]
        and marker["combinedAttemptsConsumed"] == 1
        and marker["remainingCombinedAttempts"] == 0,
        "worker-attempt-binding",
    )
    expected_names = {spec["archiveFile"] for spec in identity["plan"]["archives"]}
    require(set(config["rawIdentities"]) == expected_names, "worker-raw-file-set")
    inspections = []

    def active():
        parent_guard(read_fd)
        check_time(time.monotonic_ns, config["workCutoffMonoNs"])

    try:
        for index, spec in enumerate(identity["plan"]["archives"]):
            active()
            require(bootstrap(root) == identity, "worker-source-drift")
            path = root / RAW_REL / spec["archiveFile"]
            safe_parents(path)
            fd = os.open(path, os.O_WRONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
            try:
                info = os.fstat(fd)
                require(
                    stat.S_ISREG(info.st_mode)
                    and info.st_nlink == 1
                    and info.st_size == 0
                    and [info.st_dev, info.st_ino]
                    == config["rawIdentities"][spec["archiveFile"]],
                    "worker-raw-identity",
                )
                channel.send(
                    {
                        "type": "URL_START",
                        "attemptId": config["attemptId"],
                        "seq": index + 1,
                        "urlIndex": index,
                    },
                    config["workCutoffMonoNs"],
                )
                ack = channel.receive(config["workCutoffMonoNs"])
                require(
                    set(ack)
                    == {
                        "type",
                        "attemptId",
                        "seq",
                        "getDeadlineMonoNs",
                        "operationDeadlineMonoNs",
                    }
                    and ack["type"] == "ACK"
                    and ack["attemptId"] == config["attemptId"]
                    and type(ack["seq"]) is int
                    and ack["seq"] == index + 1
                    and type(ack["getDeadlineMonoNs"]) is int
                    and ack["getDeadlineMonoNs"] <= config["workCutoffMonoNs"]
                    and ack["getDeadlineMonoNs"] <= time.monotonic_ns() + GET_NS
                    and ack["operationDeadlineMonoNs"]
                    == config["operationDeadlineMonoNs"],
                    "ack-binding",
                )

                def progress(kind, facts):
                    active()
                    channel.send(
                        {
                            "type": kind,
                            "attemptId": config["attemptId"],
                            "seq": index + 1,
                            "urlIndex": index,
                            **facts,
                        },
                        ack["getDeadlineMonoNs"],
                    )

                with os.fdopen(fd, "wb", buffering=0, closefd=False) as sink:
                    download_archive(
                        spec,
                        sink,
                        now_ns=time.monotonic_ns,
                        open_https=real_open_https,
                        get_deadline_ns=ack["getDeadlineMonoNs"],
                        operation_deadline_ns=config["workCutoffMonoNs"],
                        progress=progress,
                        alive=active,
                    )
                    os.fsync(fd)
            finally:
                os.close(fd)
            active()
            raw = read_regular(path, ARCHIVE_CAP)
            inspections.append(inspect_verified_archive(raw, spec))
            active()
        require(bootstrap(root) == identity, "worker-final-binding-drift")
        manifest = selected_manifest(
            inspections, identity["plan"], identity, config["attemptId"]
        )
        created_count = 0

        def created(name, inode):
            nonlocal created_count
            active()
            created_count += 1
            channel.send(
                {
                    "type": "ARTIFACT_CREATED",
                    "attemptId": config["attemptId"],
                    "ordinal": created_count,
                    "path": name,
                    "device": inode[0],
                    "inode": inode[1],
                },
                config["workCutoffMonoNs"],
            )

        manifest_hash = persist_selected(
            root / OUTPUT_REL, inspections, manifest, active=active, created=created
        )
        active()
        channel.send(
            {
                "type": "DONE",
                "attemptId": config["attemptId"],
                "seq": 3,
                "manifestSha256": manifest_hash,
            },
            config["workCutoffMonoNs"],
        )
        return 0
    except (Exception, KeyboardInterrupt) as error:
        code = str(error)[:128] if isinstance(error, Stop) else type(error).__name__
        try:
            channel.send(
                {"type": "FAIL", "attemptId": config["attemptId"], "code": code},
                config["workCutoffMonoNs"],
            )
        except (Exception, KeyboardInterrupt):
            pass
        return 1


def main():
    if sys.argv[1:] == ["--execute-approved"]:
        return execute_approved()
    if sys.argv[1:] == ["--worker"]:
        return worker_main()
    raise Stop("only-fixed-execute-approved-cli-or-supervisor-worker")


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (Exception, KeyboardInterrupt) as error:
        print(type(error).__name__ + ": " + str(error)[:256], file=sys.stderr)
        sys.exit(1)
