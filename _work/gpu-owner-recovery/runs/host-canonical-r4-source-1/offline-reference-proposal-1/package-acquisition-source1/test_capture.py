# SPEC: _spec/runtime-protocol.puml
import base64
import copy
import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import signal
import socket
import struct
import subprocess
import sys
import tarfile
import unittest
from unittest import mock


SOURCE = Path(__file__).absolute().parent
ROOT = SOURCE.parents[5]
loader = importlib.util.spec_from_file_location(
    "capture_under_test", SOURCE / "capture.py"
)
cap = importlib.util.module_from_spec(loader)
loader.loader.exec_module(cap)
FIXTURES = Path(os.environ["CAPTURE_FIXTURES"]).absolute()
if FIXTURES.parent.parent != SOURCE or FIXTURES.name != "fixtures":
    raise RuntimeError("fixture-root-must-be-owned-verification-directory")
DOCUMENTS = {
    key: cap.read_regular(ROOT / path, 8 * 1024 * 1024)
    for key, path in (
        ("request", cap.R_REL / "request.json"),
        ("plan", cap.R_REL / "plan.json"),
        ("approval", cap.R_REL / "approval1.json"),
        ("lock", cap.LOCK_REL),
    )
}
PLAN = cap.validate_documents(DOCUMENTS)
SPEC = PLAN["archives"][0]
NEGATIVE_CASES = 0
GUARD_VIOLATIONS = []


def audit(event, arguments):
    if event.startswith("socket.") or event in (
        "subprocess.Popen",
        "os.system",
        "os.exec",
        "os.posix_spawn",
    ):
        GUARD_VIOLATIONS.append(event)
        raise RuntimeError("test-external-operation-forbidden")
    path = None
    writing = False
    if event == "open" and not isinstance(arguments[0], int):
        path = Path(os.fsdecode(arguments[0])).absolute()
        flags = arguments[2]
        writing = bool(
            flags & (os.O_WRONLY | os.O_RDWR | os.O_CREAT | os.O_TRUNC | os.O_APPEND)
        )
    elif event in ("os.mkdir", "os.remove", "os.rmdir", "os.chmod", "os.truncate"):
        if not isinstance(arguments[0], int):
            path = Path(os.fsdecode(arguments[0])).absolute()
            writing = True
    elif event in ("os.rename", "os.link", "os.symlink"):
        GUARD_VIOLATIONS.append(event)
        raise RuntimeError("test-path-mutation-forbidden")
    if path is not None:
        for prohibited in (
            ROOT / cap.RAW_REL,
            ROOT / cap.OUTPUT_REL,
            ROOT / cap.OP_REL,
        ):
            if path == prohibited or prohibited in path.parents:
                GUARD_VIOLATIONS.append(str(path))
                raise RuntimeError("production-operation-path-forbidden")
        if writing and FIXTURES not in path.parents:
            GUARD_VIOLATIONS.append(str(path))
            raise RuntimeError("test-write-outside-fixtures")


sys.addaudithook(audit)


def sri(data):
    return "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode("ascii")


def spec_for(data, original=SPEC):
    return {**copy.deepcopy(original), "integrity": sri(data)}


def member(name, data=b"", kind=tarfile.REGTYPE, pax=None, size=None):
    info = tarfile.TarInfo(name)
    info.type = kind
    info.size = len(data) if size is None else size
    info.linkname = (
        "package/esm/index.mjs" if kind in (tarfile.LNKTYPE, tarfile.SYMTYPE) else ""
    )
    info.pax_headers = {} if pax is None else pax
    return info, data


def required(spec=SPEC, version=None):
    package = json.dumps(
        {"name": spec["name"], "version": version or spec["version"]}
    ).encode()
    return [
        member("package/package.json", package),
        member(spec["requiredMembers"][1]["member"], b"export {};\n"),
    ]


def tar_bytes(entries, *, pax=False):
    if pax:
        sink = io.BytesIO()
        with tarfile.open(fileobj=sink, mode="w", format=tarfile.PAX_FORMAT) as archive:
            for info, data in entries:
                archive.addfile(info, io.BytesIO(data))
        return sink.getvalue()
    output = bytearray()
    for info, data in entries:
        output.extend(info.tobuf(format=tarfile.USTAR_FORMAT))
        output.extend(data)
        output.extend(b"\0" * ((-len(data)) % 512))
    output.extend(b"\0" * 1024)
    return bytes(output)


def packed(entries=None, *, pax=False, spec=SPEC):
    raw = gzip.compress(
        tar_bytes(required(spec) if entries is None else entries, pax=pax), mtime=0
    )
    return raw, spec_for(raw, spec)


class Clock:
    def __init__(self, value=0):
        self.value = value

    def now(self):
        return self.value

    def advance(self, value):
        self.value += value


class Exchange:
    def __init__(
        self,
        data,
        clock,
        *,
        costs=None,
        status=200,
        encoding=None,
        chunk=65536,
        fail=None,
    ):
        self.data = data
        self.clock = clock
        self.costs = costs or {}
        self.status = status
        self.encoding = encoding
        self.chunk = chunk
        self.fail = fail
        self.offset = 0
        self.calls = []
        self.closed = False

    def action(self, label):
        self.calls.append(label)
        self.clock.advance(self.costs.get(label, 0))
        if self.fail == label:
            raise OSError("synthetic-" + label)

    def connect(self, deadline):
        self.action("connect")

    def issue_get(self, deadline):
        self.action("request")

    def headers(self, deadline):
        self.action("headers")
        return self.status, self.encoding

    def read(self, limit, deadline):
        self.action("read")
        amount = min(limit, self.chunk)
        data = self.data[self.offset : self.offset + amount]
        self.offset += len(data)
        return data

    def close(self):
        self.closed = True


class MemoryJournal:
    def __init__(self, clock=None, delay=0, fail=False):
        self.events = []
        self.clock = clock
        self.delay = delay
        self.fail = fail

    def append(self, event):
        self.events.append(copy.deepcopy(event))
        if self.clock:
            self.clock.advance(self.delay)
        if self.fail:
            raise OSError("synthetic-journal-failure")


def marker():
    return {
        "attemptId": "mock-attempt",
        "originMonoNs": 0,
        "workCutoffMonoNs": cap.WORK_NS,
        "operationDeadlineMonoNs": cap.OP_NS,
    }


def start(index=0, seq=None):
    return {
        "type": "URL_START",
        "attemptId": "mock-attempt",
        "seq": index + 1 if seq is None else seq,
        "urlIndex": index,
    }


def issued(index=0):
    return {
        "type": "GET_ISSUED",
        "attemptId": "mock-attempt",
        "seq": index + 1,
        "urlIndex": index,
    }


def completed(index=0):
    return {
        "type": "RESPONSE_COMPLETED",
        "attemptId": "mock-attempt",
        "seq": index + 1,
        "urlIndex": index,
        "bytes": 1,
        "sha256": "a" * 64,
        "sha512": "b" * 128,
    }


def done():
    return {
        "type": "DONE",
        "attemptId": "mock-attempt",
        "seq": 3,
        "manifestSha256": "c" * 64,
    }


def conversation():
    return [start(), issued(), completed(), start(1), issued(1), completed(1), done()]


class FakeProcess:
    pid = 991122

    def __init__(self, code=0, waits=None, clock=None):
        self.code = code
        self.waits = list(waits or [])
        self.clock = clock
        self.reaped = False
        self.wait_calls = []

    def poll(self):
        if self.code is not None:
            self.reaped = True
        return self.code

    def wait(self, timeout):
        self.wait_calls.append(timeout)
        value = self.waits.pop(0) if self.waits else self.code
        if value is None:
            if self.clock:
                self.clock.advance(int(timeout * cap.SECOND))
            raise subprocess.TimeoutExpired("mock-worker", timeout)
        self.code = value
        self.reaped = True
        return value


class ScriptChannel:
    def __init__(self, frames, clock, *, blocked_ack=False, late=False):
        self.frames = list(frames)
        self.clock = clock
        self.acks = []
        self.blocked_ack = blocked_ack
        self.late = late

    def receive(self, deadline):
        if self.late:
            self.clock.value = deadline
            cap.check_time(self.clock.now, deadline)
        if not self.frames:
            raise EOFError()
        frame = self.frames.pop(0)
        if isinstance(frame, BaseException):
            raise frame
        return frame

    def send(self, ack, deadline):
        if self.blocked_ack:
            self.clock.value = deadline
            cap.check_time(self.clock.now, deadline)
        self.acks.append(ack)


class Cases(unittest.TestCase):
    def reject(self, function, *args, error=cap.Stop, **kwargs):
        global NEGATIVE_CASES
        with self.assertRaises(error):
            function(*args, **kwargs)
        NEGATIVE_CASES += 1

    def folder(self):
        path = FIXTURES / self.id().rsplit(".", 1)[-1]
        path.mkdir()
        return path

    def download(self, data, **options):
        clock = options.pop("clock", Clock())
        exchange = Exchange(data, clock, **options)
        sink = io.BytesIO()
        events = []
        result = cap.download_archive(
            spec_for(data),
            sink,
            now_ns=clock.now,
            open_https=lambda spec, now_ns: exchange,
            get_deadline_ns=cap.GET_NS,
            operation_deadline_ns=cap.WORK_NS,
            progress=lambda kind, facts: events.append((kind, facts)),
        )
        return result, sink.getvalue(), exchange, events

    def test_pinned_documents_and_historical_status(self):
        self.assertEqual(cap.validate_documents(DOCUMENTS), PLAN)
        self.assertEqual(
            cap.parse_json(DOCUMENTS["request"])[
                "currentAuthorizedAcquisitionAttempts"
            ],
            0,
        )
        self.assertEqual(
            cap.parse_json(DOCUMENTS["approval"])[
                "remainingCombinedAttemptsAtIssuance"
            ],
            1,
        )

    def test_each_document_binding_rejects_drift(self):
        for key in DOCUMENTS:
            altered = dict(DOCUMENTS)
            altered[key] += b" "
            self.reject(cap.validate_documents, altered)

    def test_null_factory_rejected_before_clock(self):
        for value in (None, False, 0, "", {}, []):
            self.reject(
                cap.Downloader,
                open_https=value,
                now_ns=lambda: self.fail("invalid-factory-consulted-clock"),
            )

    def test_invalid_factory_pure_function_never_falls_back(self):
        with mock.patch.object(
            cap, "real_open_https", side_effect=AssertionError("real-fallback")
        ):
            self.reject(
                cap.download_archive,
                SPEC,
                io.BytesIO(),
                now_ns=lambda: self.fail("clock"),
                open_https=None,
                get_deadline_ns=1,
                operation_deadline_ns=1,
            )

    def test_exact_archive_byte_cap(self):
        raw = b"x" * cap.ARCHIVE_CAP
        result, retained, exchange, events = self.download(raw)
        self.assertEqual(result["bytes"], cap.ARCHIVE_CAP)
        self.assertEqual(retained, raw)
        self.assertEqual(
            [kind for kind, facts in events], ["GET_ISSUED", "RESPONSE_COMPLETED"]
        )
        self.assertTrue(exchange.closed)

    def test_archive_byte_cap_plus_one_preserves_prefix(self):
        raw = b"x" * (cap.ARCHIVE_CAP + 1)
        clock = Clock()
        exchange = Exchange(raw, clock)
        sink = io.BytesIO()
        self.reject(
            cap.download_archive,
            spec_for(raw),
            sink,
            now_ns=clock.now,
            open_https=lambda spec, now_ns: exchange,
            get_deadline_ns=cap.GET_NS,
            operation_deadline_ns=cap.WORK_NS,
        )
        self.assertEqual(len(sink.getvalue()), cap.ARCHIVE_CAP)
        self.assertTrue(exchange.closed)

    def test_dns_connect_absolute_deadline(self):
        for label in ("dns", "tls", "connect"):
            clock = Clock()
            exchange = Exchange(b"x", clock, costs={"connect": cap.GET_NS})
            self.reject(
                cap.download_archive,
                spec_for(b"x"),
                io.BytesIO(),
                now_ns=clock.now,
                open_https=lambda spec, now_ns: exchange,
                get_deadline_ns=cap.GET_NS,
                operation_deadline_ns=cap.WORK_NS,
            )
            self.assertEqual(exchange.calls, ["connect"], label)

    def test_header_deadline_includes_connect_and_request(self):
        clock = Clock()
        exchange = Exchange(
            b"x",
            clock,
            costs={
                "connect": 12 * cap.SECOND,
                "request": 8 * cap.SECOND,
                "headers": 10 * cap.SECOND,
            },
        )
        self.reject(
            cap.download_archive,
            spec_for(b"x"),
            io.BytesIO(),
            now_ns=clock.now,
            open_https=lambda spec, now_ns: exchange,
            get_deadline_ns=cap.GET_NS,
            operation_deadline_ns=cap.WORK_NS,
        )
        self.assertNotIn("read", exchange.calls)

    def test_drip_never_renews_absolute_deadline(self):
        clock = Clock()
        exchange = Exchange(b"abcdef", clock, costs={"read": 10 * cap.SECOND}, chunk=1)
        sink = io.BytesIO()
        self.reject(
            cap.download_archive,
            spec_for(b"abcdef"),
            sink,
            now_ns=clock.now,
            open_https=lambda spec, now_ns: exchange,
            get_deadline_ns=cap.GET_NS,
            operation_deadline_ns=cap.WORK_NS,
        )
        self.assertEqual(sink.getvalue(), b"ab")
        self.assertEqual(clock.value, cap.GET_NS)

    def test_operation_cutoff_can_shorten_get(self):
        clock = Clock()
        exchange = Exchange(b"x", clock, costs={"connect": 5 * cap.SECOND})
        self.reject(
            cap.download_archive,
            spec_for(b"x"),
            io.BytesIO(),
            now_ns=clock.now,
            open_https=lambda spec, now_ns: exchange,
            get_deadline_ns=cap.GET_NS,
            operation_deadline_ns=5 * cap.SECOND,
        )

    def test_no_redirect_or_error_response_retry(self):
        for status in (301, 302, 307, 308, 404, 500):
            clock = Clock()
            exchange = Exchange(b"x", clock, status=status)
            self.reject(
                cap.download_archive,
                spec_for(b"x"),
                io.BytesIO(),
                now_ns=clock.now,
                open_https=lambda spec, now_ns: exchange,
                get_deadline_ns=cap.GET_NS,
                operation_deadline_ns=cap.WORK_NS,
            )
            self.assertEqual(exchange.calls, ["connect", "request", "headers"])

    def test_http_body_decompression_forbidden(self):
        self.reject(self.download, b"x", encoding="gzip")

    def test_connection_failure_preserves_empty_archive(self):
        clock = Clock()
        exchange = Exchange(b"x", clock, fail="connect")
        sink = io.BytesIO()
        self.reject(
            cap.download_archive,
            spec_for(b"x"),
            sink,
            now_ns=clock.now,
            open_https=lambda spec, now_ns: exchange,
            get_deadline_ns=cap.GET_NS,
            operation_deadline_ns=cap.WORK_NS,
            error=OSError,
        )
        self.assertEqual(sink.getvalue(), b"")
        self.assertTrue(exchange.closed)

    def test_parent_death_prevents_request(self):
        clock = Clock()
        exchange = Exchange(b"x", clock)

        def alive():
            if "connect" in exchange.calls:
                raise cap.Stop("synthetic-parent-eof")

        self.reject(
            cap.download_archive,
            spec_for(b"x"),
            io.BytesIO(),
            now_ns=clock.now,
            open_https=lambda spec, now_ns: exchange,
            get_deadline_ns=cap.GET_NS,
            operation_deadline_ns=cap.WORK_NS,
            alive=alive,
        )
        self.assertEqual(exchange.calls, ["connect"])

    def test_stream_bad_sri_rejected_after_raw_preserved(self):
        clock = Clock()
        exchange = Exchange(b"actual", clock)
        sink = io.BytesIO()
        self.reject(
            cap.download_archive,
            spec_for(b"other"),
            sink,
            now_ns=clock.now,
            open_https=lambda spec, now_ns: exchange,
            get_deadline_ns=cap.GET_NS,
            operation_deadline_ns=cap.WORK_NS,
        )
        self.assertEqual(sink.getvalue(), b"actual")

    def test_bad_sri_before_any_gzip(self):
        with mock.patch.object(
            cap.gzip, "GzipFile", side_effect=AssertionError("inflate-before-sri")
        ):
            self.reject(cap.inspect_verified_archive, b"wrong", SPEC)

    def test_required_members_and_absent_license(self):
        raw, spec = packed()
        result = cap.inspect_verified_archive(raw, spec)
        self.assertEqual(len(result["files"]), 2)
        self.assertIsNone(result["licenseMember"])
        self.assertFalse(result["legalClearance"])
        self.assertEqual(result["files"][1]["data"], b"export {};\n")

    def test_second_exact_runtime_member(self):
        raw, spec = packed(spec=PLAN["archives"][1])
        result = cap.inspect_verified_archive(raw, spec)
        self.assertEqual(result["files"][1]["member"], "package/dist/sha256.mjs")

    def test_license_preference_not_archive_order(self):
        entries = required() + [
            member("package/LICENSE.txt", b"txt"),
            member("package/LICENSE.md", b"md"),
            member("package/LICENSE", b"ORIGINAL\r\nNOTICE\xff"),
        ]
        raw, spec = packed(entries)
        result = cap.inspect_verified_archive(raw, spec)
        self.assertEqual(result["licenseMember"], "package/LICENSE")
        self.assertEqual(result["files"][-1]["retainedFile"], "fflate-0.8.3-LICENSE")
        self.assertEqual(result["files"][-1]["data"], b"ORIGINAL\r\nNOTICE\xff")

    def test_optional_license_basename_mapping(self):
        raw, spec = packed(required() + [member("package/LICENSE.md", b"notice")])
        result = cap.inspect_verified_archive(raw, spec)
        self.assertEqual(result["files"][-1]["retainedFile"], "fflate-0.8.3-LICENSE.md")

    def test_package_version_mismatch(self):
        raw, spec = packed(required(version="0.0.0"))
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_package_name_mismatch(self):
        entries = required()
        entries[0] = member(
            "package/package.json", b'{"name":"other","version":"0.8.3"}'
        )
        raw, spec = packed(entries)
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_duplicate_json_identity_rejected(self):
        entries = required()
        entries[0] = member(
            "package/package.json",
            b'{"name":"other","name":"fflate","version":"0.8.3"}',
        )
        raw, spec = packed(entries)
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_no_package_code_evaluation(self):
        entries = required()
        entries[1] = member(
            SPEC["requiredMembers"][1]["member"],
            b'throw new Error("MUST NOT EXECUTE");',
        )
        raw, spec = packed(entries)
        result = cap.inspect_verified_archive(raw, spec)
        self.assertEqual(result["files"][1]["data"], entries[1][1])

    def test_missing_required_member(self):
        raw, spec = packed(required()[:1])
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_selected_physical_duplicates(self):
        for extra in (required()[0], member("package/LICENSE", b"b")):
            entries = required() + [member("package/LICENSE", b"a"), extra]
            raw, spec = packed(entries)
            self.reject(cap.inspect_verified_archive, raw, spec)

    def test_selected_links_nonregular_and_sparse(self):
        for kind in (
            tarfile.SYMTYPE,
            tarfile.LNKTYPE,
            tarfile.DIRTYPE,
            tarfile.FIFOTYPE,
            tarfile.GNUTYPE_SPARSE,
        ):
            entries = [
                required()[0],
                member(SPEC["requiredMembers"][1]["member"], b"", kind),
            ]
            raw, spec = packed(entries)
            self.reject(cap.inspect_verified_archive, raw, spec)

    def test_pax_rename_into_selected_rejected(self):
        entries = [
            required()[0],
            member(
                "unselected",
                b"export {};\n",
                pax={"path": SPEC["requiredMembers"][1]["member"]},
            ),
        ]
        raw, spec = packed(entries, pax=True)
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_pax_rename_away_from_selected_rejected(self):
        entries = [
            required()[0],
            member(
                SPEC["requiredMembers"][1]["member"],
                b"export {};\n",
                pax={"path": "unselected"},
            ),
        ]
        raw, spec = packed(entries, pax=True)
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_pax_size_disagreement_rejected(self):
        entries = [
            required()[0],
            member(
                SPEC["requiredMembers"][1]["member"], b"export {};\n", pax={"size": "1"}
            ),
        ]
        raw, spec = packed(entries, pax=True)
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_pax_sparse_metadata_rejected(self):
        entries = [
            required()[0],
            member(
                SPEC["requiredMembers"][1]["member"],
                b"export {};\n",
                pax={"GNU.sparse.map": "0,1", "GNU.sparse.size": "10"},
            ),
        ]
        raw, spec = packed(entries, pax=True)
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_benign_pax_metadata_counts_physically(self):
        entries = [
            required()[0],
            member(
                SPEC["requiredMembers"][1]["member"],
                b"export {};\n",
                pax={"mtime": "0.5"},
            ),
        ]
        raw, spec = packed(entries, pax=True)
        result = cap.inspect_verified_archive(raw, spec)
        self.assertEqual(result["physicalTarHeaders"], 3)

    def test_gnu_longname_selected_rename_rejected(self):
        name = SPEC["requiredMembers"][1]["member"]
        entries = [
            required()[0],
            member("././@LongLink", name.encode() + b"\0", tarfile.GNUTYPE_LONGNAME),
            member("unselected", b"x"),
        ]
        raw, spec = packed(entries)
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_metadata_headers_count_toward_cap(self):
        entries = [
            member("meta", b"", tarfile.XHDTYPE) for _ in range(cap.HEADER_CAP + 1)
        ] + required()
        raw, spec = packed(entries)
        with mock.patch.object(
            cap.tarfile,
            "open",
            side_effect=AssertionError("logical-before-physical-cap"),
        ):
            self.reject(cap.inspect_verified_archive, raw, spec)

    def test_exact_physical_header_cap(self):
        entries = required() + [
            member("ignored-" + str(index)) for index in range(cap.HEADER_CAP - 2)
        ]
        raw, spec = packed(entries)
        self.assertEqual(
            cap.inspect_verified_archive(raw, spec)["physicalTarHeaders"],
            cap.HEADER_CAP,
        )

    def test_skipped_content_counts_toward_expanded_work(self):
        entries = required() + [member("ignored", b"x" * cap.EXPANDED_CAP)]
        raw, spec = packed(entries)
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_exact_expanded_cap_includes_skipped_content(self):
        entries = required() + [member("ignored", b"x" * (cap.EXPANDED_CAP - 3584))]
        raw, spec = packed(entries)
        self.assertEqual(
            cap.inspect_verified_archive(raw, spec)[
                "expandedBytesIncludingSkippedContent"
            ],
            cap.EXPANDED_CAP,
        )

    def test_expanded_cap_plus_one_before_tar(self):
        raw = gzip.compress(b"\0" * (cap.EXPANDED_CAP + 1), mtime=0)
        with mock.patch.object(
            cap.tarfile, "open", side_effect=AssertionError("tar-before-expanded-cap")
        ):
            self.reject(cap.inspect_verified_archive, raw, spec_for(raw))

    def test_physical_checksum_rejected(self):
        data = bytearray(tar_bytes(required()))
        data[0] ^= 1
        raw = gzip.compress(data, mtime=0)
        self.reject(cap.inspect_verified_archive, raw, spec_for(raw))

    def test_physical_size_bounds_rejected(self):
        raw, spec = packed([member("oversized", size=cap.EXPANDED_CAP)] + required())
        self.reject(cap.inspect_verified_archive, raw, spec)

    def test_tar_terminator_and_alignment_required(self):
        original = tar_bytes(required())
        for data in (original[:-1024], original + b"x", original[:-1] + b"x"):
            raw = gzip.compress(data, mtime=0)
            self.reject(cap.inspect_verified_archive, raw, spec_for(raw))

    def test_frame_split_header_and_payload(self):
        clock = Clock()
        payload = cap.encoded({"type": "MOCK"}, cap.FRAME_CAP)
        data = bytearray(struct.pack("!I", len(payload)) + payload)
        sizes = []

        def read(fd, size):
            sizes.append(size)
            result = bytes(data[:1])
            del data[:1]
            return result

        channel = cap.FrameChannel(
            1, 2, now_ns=clock.now, read=read, wait=lambda r, w, e, timeout: (r, w, [])
        )
        self.assertEqual(channel.receive(cap.SECOND), {"type": "MOCK"})
        self.assertLessEqual(max(sizes), cap.FRAME_CAP)

    def test_oversized_frame_rejected_before_payload_read(self):
        reads = []

        def read(fd, size):
            reads.append(size)
            return struct.pack("!I", cap.FRAME_CAP + 1)

        channel = cap.FrameChannel(
            1,
            2,
            now_ns=Clock().now,
            read=read,
            wait=lambda r, w, e, timeout: (r, w, []),
        )
        self.reject(channel.receive, cap.SECOND)
        self.assertEqual(reads, [4])

    def test_empty_frame_rejected(self):
        channel = cap.FrameChannel(
            1,
            2,
            now_ns=Clock().now,
            read=lambda fd, size: b"\0" * 4,
            wait=lambda r, w, e, timeout: (r, w, []),
        )
        self.reject(channel.receive, cap.SECOND)

    def test_truncated_header_and_payload(self):
        for pieces in ([b"\0", b""], [struct.pack("!I", 10), b"{}", b""]):
            pieces = list(pieces)
            channel = cap.FrameChannel(
                1,
                2,
                now_ns=Clock().now,
                read=lambda fd, size: pieces.pop(0),
                wait=lambda r, w, e, timeout: (r, w, []),
            )
            self.reject(channel.receive, cap.SECOND)

    def test_json_frame_duplicate_keys_rejected(self):
        data = b'{"type":"a","type":"b"}'
        pieces = [struct.pack("!I", len(data)), data]
        channel = cap.FrameChannel(
            1,
            2,
            now_ns=Clock().now,
            read=lambda fd, size: pieces.pop(0),
            wait=lambda r, w, e, timeout: (r, w, []),
        )
        self.reject(channel.receive, cap.SECOND)

    def test_ack_blocked_deadline_bounded(self):
        clock = Clock()

        def wait(r, w, e, timeout):
            clock.advance(int(timeout * cap.SECOND) or 1)
            return [], [], []

        channel = cap.FrameChannel(
            1,
            2,
            now_ns=clock.now,
            wait=wait,
            write=lambda fd, data: self.fail("blocked-pipe-write"),
        )
        self.reject(channel.send, {"type": "ACK"}, cap.SECOND)
        self.assertEqual(clock.now(), cap.SECOND)

    def test_ack_split_writes_roundtrip(self):
        output = bytearray()

        def write(fd, data):
            output.extend(data[:1])
            return 1

        channel = cap.FrameChannel(
            1,
            2,
            now_ns=Clock().now,
            write=write,
            wait=lambda r, w, e, timeout: (r, w, []),
        )
        value = {"type": "ACK", "seq": 1}
        channel.send(value, cap.SECOND)
        self.assertEqual(cap.parse_json(output[4:]), value)
        self.assertEqual(struct.unpack("!I", output[:4])[0], len(output) - 4)

    def test_claim_exclusive_and_snapshot_preserved(self):
        path = self.folder() / "mock-operation"
        snapshot = bytes(DOCUMENTS["approval"])
        claimed, journal = cap.claim_attempt(path, {"mock": True}, now_ns=Clock().now)
        journal.close()
        self.assertEqual(claimed["combinedAttemptsConsumed"], 1)
        self.assertEqual(claimed["remainingCombinedAttempts"], 0)
        self.reject(
            cap.claim_attempt,
            path,
            {"mock": True},
            now_ns=Clock().now,
            error=FileExistsError,
        )
        self.assertEqual(snapshot, DOCUMENTS["approval"])

    def test_existing_empty_operation_root_blocks_replay(self):
        path = self.folder() / "mock-operation"
        path.mkdir()
        self.reject(
            cap.claim_attempt, path, {}, now_ns=Clock().now, error=FileExistsError
        )
        self.assertEqual(list(path.iterdir()), [])

    def test_concurrent_exclusive_claim_has_one_winner(self):
        import threading

        path = self.folder() / "mock-operation"
        barrier = threading.Barrier(2)
        results = []

        def contender():
            barrier.wait(timeout=2)
            try:
                claimed, journal = cap.claim_attempt(path, {}, now_ns=Clock().now)
                journal.close()
                results.append("claimed")
            except FileExistsError:
                results.append("blocked")

        threads = [threading.Thread(target=contender) for _ in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=3)
            self.assertFalse(thread.is_alive())
        self.assertCountEqual(results, ["claimed", "blocked"])

    def test_preflight_failure_consumes_combined_without_gets(self):
        path = self.folder() / "mock-operation"
        claimed, journal = cap.claim_attempt(path, {}, now_ns=Clock().now)
        protocol = cap.Protocol(claimed, journal, now_ns=Clock().now)
        self.reject(cap.require, False, "synthetic-preflight")
        journal.close()
        facts = protocol.facts()
        self.assertEqual(
            (
                facts["combinedAttemptsConsumed"],
                facts["remainingCombinedAttempts"],
                facts["urlStartsConsumed"],
                facts["remainingGetSlots"],
            ),
            (1, 0, 0, 2),
        )
        self.assertFalse(facts["unusedGetSlotsRenewCombinedAllowance"])

    def test_url_start_durable_before_ack_and_deadline_origin(self):
        clock = Clock(7 * cap.SECOND)
        journal = MemoryJournal(clock, delay=3 * cap.SECOND)
        protocol = cap.Protocol(marker(), journal, now_ns=clock.now)
        ack = protocol.accept(start())
        self.assertEqual(len(journal.events), 1)
        self.assertEqual(ack["getDeadlineMonoNs"], 37 * cap.SECOND)
        self.assertEqual(protocol.facts()["getRequestsIssued"], None)

    def test_url_start_journal_failure_never_returns_ack(self):
        protocol = cap.Protocol(marker(), MemoryJournal(fail=True), now_ns=Clock().now)
        self.reject(protocol.accept, start(), error=OSError)
        self.assertEqual(protocol.facts()["urlStartsConsumed"], 1)
        self.assertIsNone(protocol.facts()["getRequestsIssued"])

    def test_journal_delay_cannot_extend_get(self):
        clock = Clock()
        protocol = cap.Protocol(
            marker(), MemoryJournal(clock, delay=cap.GET_NS), now_ns=clock.now
        )
        self.reject(protocol.accept, start())
        self.assertEqual(protocol.facts()["urlStartsConsumed"], 1)

    def test_duplicate_third_wrong_order_and_wrong_attempt(self):
        for bad in (
            start(1),
            start(2),
            start(0, seq=2),
            {**start(), "attemptId": "borrowed"},
            {**start(), "urlIndex": False},
            {**start(), "grantId": "new-grant"},
        ):
            protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=Clock().now)
            self.reject(protocol.accept, bad)
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=Clock().now)
        protocol.accept(start())
        self.reject(protocol.accept, start())
        self.reject(protocol.accept, start(1))
        protocol.accept(issued())
        protocol.accept(completed())
        protocol.accept(start(1))
        protocol.accept(issued(1))
        protocol.accept(completed(1))
        self.reject(protocol.accept, start(2))
        self.assertEqual(protocol.facts()["remainingCombinedAttempts"], 0)

    def test_issuance_uncertainty_after_interrupted_ack(self):
        clock = Clock()
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=clock.now)
        process = FakeProcess()
        channel = ScriptChannel([start()], clock, blocked_ack=True)
        self.reject(
            cap.supervise_worker,
            process,
            channel,
            protocol,
            validate_done=lambda frame: None,
            current_bindings=lambda: None,
            now_ns=clock.now,
        )
        self.assertIsNone(protocol.facts()["getRequestsIssued"])
        self.assertEqual(protocol.facts()["remainingCombinedAttempts"], 0)

    def test_exit_zero_without_done_fails(self):
        clock = Clock()
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=clock.now)
        self.reject(
            cap.supervise_worker,
            FakeProcess(),
            ScriptChannel([], clock),
            protocol,
            validate_done=lambda frame: None,
            current_bindings=lambda: None,
            now_ns=clock.now,
        )

    def test_eof_after_url_start_stays_uncertain(self):
        clock = Clock()
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=clock.now)
        self.reject(
            cap.supervise_worker,
            FakeProcess(),
            ScriptChannel([start()], clock),
            protocol,
            validate_done=lambda frame: None,
            current_bindings=lambda: None,
            now_ns=clock.now,
        )
        self.assertIsNone(protocol.facts()["getRequestsIssued"])

    def test_response_without_issuance_and_duplicate_issued_reject(self):
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=Clock().now)
        protocol.accept(start())
        self.reject(protocol.accept, completed())
        protocol.accept(issued())
        self.reject(protocol.accept, issued())
        protocol.accept(completed())
        self.reject(protocol.accept, completed())

    def test_supervisor_complete_requires_reap_then_files_then_bindings(self):
        clock = Clock()
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=clock.now)
        process = FakeProcess()
        order = []

        def validate(frame):
            self.assertTrue(process.reaped)
            order.append("files")

        cap.supervise_worker(
            process,
            ScriptChannel(conversation(), clock),
            protocol,
            validate_done=validate,
            current_bindings=lambda: order.append("bindings"),
            now_ns=clock.now,
        )
        self.assertEqual(order, ["files", "bindings"])
        self.assertEqual(protocol.facts()["getRequestsIssued"], 2)
        self.assertEqual(protocol.facts()["responsesCompleted"], 2)

    def test_supervisor_late_frame_fails(self):
        clock = Clock()
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=clock.now)
        self.reject(
            cap.supervise_worker,
            FakeProcess(),
            ScriptChannel([start()], clock, late=True),
            protocol,
            validate_done=lambda frame: None,
            current_bindings=lambda: None,
            now_ns=clock.now,
        )

    def test_done_without_two_responses_rejected(self):
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=Clock().now)
        self.reject(protocol.accept, done())

    def test_trailing_frame_after_done_rejected(self):
        clock = Clock()
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=clock.now)
        self.reject(
            cap.supervise_worker,
            FakeProcess(),
            ScriptChannel(conversation() + [start()], clock),
            protocol,
            validate_done=lambda frame: None,
            current_bindings=lambda: None,
            now_ns=clock.now,
        )

    def test_worker_nonzero_even_with_done_fails(self):
        clock = Clock()
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=clock.now)
        self.reject(
            cap.supervise_worker,
            FakeProcess(code=1),
            ScriptChannel(conversation(), clock),
            protocol,
            validate_done=lambda frame: None,
            current_bindings=lambda: None,
            now_ns=clock.now,
        )

    def test_done_but_exit_blocked_fails_with_original_cutoff(self):
        clock = Clock()
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=clock.now)
        process = FakeProcess(code=None, clock=clock)
        self.reject(
            cap.supervise_worker,
            process,
            ScriptChannel(conversation(), clock),
            protocol,
            validate_done=lambda frame: None,
            current_bindings=lambda: None,
            now_ns=clock.now,
        )
        self.assertEqual(clock.now(), cap.WORK_NS)

    def test_completion_binding_drift_fails(self):
        clock = Clock()
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=clock.now)

        def drift():
            raise cap.Stop("synthetic-source-drift")

        self.reject(
            cap.supervise_worker,
            FakeProcess(),
            ScriptChannel(conversation(), clock),
            protocol,
            validate_done=lambda frame: None,
            current_bindings=drift,
            now_ns=clock.now,
        )

    def test_manifest_validation_late_fails(self):
        clock = Clock()
        protocol = cap.Protocol(marker(), MemoryJournal(), now_ns=clock.now)
        self.reject(
            cap.supervise_worker,
            FakeProcess(),
            ScriptChannel(conversation(), clock),
            protocol,
            validate_done=lambda frame: clock.advance(cap.WORK_NS),
            current_bindings=lambda: None,
            now_ns=clock.now,
        )

    def test_cleanup_term_ignored_then_kill_reaped(self):
        clock = Clock(cap.WORK_NS)
        signals = []
        process = FakeProcess(code=None, waits=[None, -9], clock=clock)
        facts = cap.cleanup_worker(
            process,
            now_ns=clock.now,
            deadline_ns=cap.OP_NS - cap.SECOND,
            killpg=lambda pid, sig: signals.append((pid, sig)),
        )
        self.assertEqual(
            [sig for pid, sig in signals], [signal.SIGTERM, signal.SIGKILL]
        )
        self.assertTrue(facts["workerReaped"])
        self.assertTrue(facts["killSent"])

    def test_cleanup_reports_unresolved_reaping(self):
        clock = Clock(cap.WORK_NS)
        process = FakeProcess(code=None, waits=[None, None], clock=clock)
        facts = cap.cleanup_worker(
            process,
            now_ns=clock.now,
            deadline_ns=cap.OP_NS - cap.SECOND,
            killpg=lambda pid, sig: None,
        )
        self.assertFalse(facts["workerReaped"])
        self.assertTrue(facts["reapingUnresolved"])
        self.assertLess(clock.now(), cap.OP_NS)

    def test_cleanup_does_not_signal_already_reaped_worker(self):
        facts = cap.cleanup_worker(
            FakeProcess(),
            now_ns=Clock().now,
            deadline_ns=cap.OP_NS,
            killpg=lambda pid, sig: self.fail("signal-reaped"),
        )
        self.assertTrue(facts["workerReaped"])
        self.assertFalse(facts["termSent"])

    def test_journal_and_receipt_caps_before_write(self):
        path = self.folder()
        self.reject(
            cap.write_json, path / "oversized.json", {"x": "x" * cap.RECEIPT_CAP}
        )
        self.assertFalse((path / "oversized.json").exists())
        journal = cap.Journal(path / "events.jsonl")
        self.reject(journal.append, {"x": "x" * cap.JOURNAL_CAP})
        journal.close()
        self.assertEqual((path / "events.jsonl").read_bytes(), b"")

    def test_journal_cumulative_cap_preserves_prefix(self):
        path = self.folder()
        journal = cap.Journal(path / "events.jsonl")
        journal.append({"x": "x" * 10000})
        self.reject(journal.append, {"x": "x" * 10000})
        journal.close()
        self.assertEqual(len((path / "events.jsonl").read_bytes()), 10009)

    def inspections(self):
        results = []
        for spec in PLAN["archives"]:
            raw, synthetic = packed(spec=spec)
            results.append(cap.inspect_verified_archive(raw, synthetic))
        return results

    def test_manifest_precedes_flat_selected_writes_and_recheck(self):
        path = self.folder()
        (path / "files").mkdir()
        inspections = self.inspections()
        manifest = cap.selected_manifest(
            inspections, PLAN, {"mock": True}, "mock-attempt"
        )
        calls = []
        original = cap.write_exclusive

        def write(pathname, data, limit):
            calls.append(pathname.name)
            return original(pathname, data, limit)

        with mock.patch.object(cap, "write_exclusive", side_effect=write):
            digest = cap.persist_selected(path, inspections, manifest)
        self.assertEqual(calls[0], "selected-input-manifest.json")
        self.assertEqual(
            cap.validate_selected(path, PLAN, {"mock": True}, "mock-attempt", digest),
            manifest,
        )
        self.assertEqual(len(list((path / "files").iterdir())), 4)

    def test_output_collision_preserves_existing_and_manifest(self):
        path = self.folder()
        (path / "files").mkdir()
        inspections = self.inspections()
        manifest = cap.selected_manifest(inspections, PLAN, {}, "mock-attempt")
        collision = path / "files" / manifest["files"][0]["retainedFile"]
        collision.write_bytes(b"unfamiliar")
        self.reject(
            cap.persist_selected, path, inspections, manifest, error=FileExistsError
        )
        self.assertEqual(collision.read_bytes(), b"unfamiliar")
        self.assertEqual(
            cap.parse_json((path / "selected-input-manifest.json").read_bytes()),
            manifest,
        )

    def test_manifest_collision_preserves_all_existing_bytes(self):
        path = self.folder()
        (path / "files").mkdir()
        target = path / "selected-input-manifest.json"
        target.write_bytes(b"unfamiliar")
        self.reject(
            cap.persist_selected, path, self.inspections(), {}, error=FileExistsError
        )
        self.assertEqual(target.read_bytes(), b"unfamiliar")
        self.assertEqual(list((path / "files").iterdir()), [])

    def test_selected_failure_preserves_earlier_files(self):
        path = self.folder()
        (path / "files").mkdir()
        inspections = self.inspections()
        manifest = cap.selected_manifest(inspections, PLAN, {}, "mock-attempt")
        count = 0

        def active():
            nonlocal count
            count += 1
            if count == 4:
                raise cap.Stop("synthetic-interruption")

        self.reject(cap.persist_selected, path, inspections, manifest, active=active)
        self.assertTrue((path / "selected-input-manifest.json").exists())
        self.assertEqual(len(list((path / "files").iterdir())), 1)

    def test_selected_file_hash_drift_rejected(self):
        path = self.folder()
        (path / "files").mkdir()
        inspections = self.inspections()
        manifest = cap.selected_manifest(inspections, PLAN, {}, "mock-attempt")
        digest = cap.persist_selected(path, inspections, manifest)
        (path / "files" / manifest["files"][1]["retainedFile"]).write_bytes(b"changed")
        self.reject(cap.validate_selected, path, PLAN, {}, "mock-attempt", digest)

    def test_aggregate_selected_cap(self):
        inspections = self.inspections()
        for inspection in inspections:
            inspection["files"][1]["data"] = b"x" * (cap.SELECTED_CAP // 2)
        self.reject(cap.selected_manifest, inspections, PLAN, {}, "mock-attempt")

    def test_flat_mapping_rejects_parent_escape(self):
        inspections = self.inspections()
        inspections[0]["files"][0]["retainedFile"] = "../escape"
        self.reject(cap.selected_manifest, inspections, PLAN, {}, "mock-attempt")

    def ready_material(self):
        hashes = {name: "a" * 64 for name in cap.CODE_FILES}
        receipt = {
            "status": "PASS_MOCK_ONLY",
            "sourceHashes": hashes,
            "bindings": cap.PINS,
            "unitTests": 1,
            "negativeCases": 1,
            "actualAcquisitionInvoked": False,
            "actualWorkerInvoked": False,
            "productionPathsTouched": False,
        }
        data = cap.encoded(receipt, cap.RECEIPT_CAP)
        path = cap.SOURCE_REL / "verification-1/receipt.json"
        ready = {
            "version": "chess-coach.reference-package-implementation-ready.v1",
            "grantId": cap.GRANT,
            "sourceHashes": hashes,
            "bindings": cap.PINS,
            "nonAuthorizing": True,
            "reviewStatuses": {
                "adversarial": "READY",
                "security": "READY",
                "devops": "READY",
            },
            "mockVerificationReceipt": {"path": str(path), "sha256": cap.sha256(data)},
        }
        return ready, hashes, data, path

    def test_non_authorizing_identity_binding(self):
        ready, hashes, receipt, path = self.ready_material()
        cap.validate_ready(ready, hashes, receipt, path)
        self.assertTrue(ready["nonAuthorizing"])

    def test_ready_requires_all_three_ready_reviews(self):
        for role in ("adversarial", "security", "devops"):
            ready, hashes, receipt, path = self.ready_material()
            ready["reviewStatuses"][role] = "PENDING"
            self.reject(cap.validate_ready, ready, hashes, receipt, path)

    def test_ready_source_receipt_grant_and_approval_drift(self):
        for field in (
            "sourceHashes",
            "mockVerificationReceipt",
            "grantId",
            "bindings",
            "nonAuthorizing",
        ):
            ready, hashes, receipt, path = self.ready_material()
            ready[field] = (
                {}
                if field in ("sourceHashes", "bindings", "mockVerificationReceipt")
                else "other"
            )
            self.reject(cap.validate_ready, ready, hashes, receipt, path)

    def test_identity_cannot_borrow_prior_or_unverified_proof(self):
        ready, hashes, receipt, path = self.ready_material()
        document = cap.parse_json(receipt)
        document["actualWorkerInvoked"] = True
        altered = cap.encoded(document, cap.RECEIPT_CAP)
        ready["mockVerificationReceipt"]["sha256"] = cap.sha256(altered)
        self.reject(cap.validate_ready, ready, hashes, altered, path)

    def test_no_guard_violations(self):
        self.assertEqual(GUARD_VIOLATIONS, [])


if __name__ == "__main__":
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(Cases)
    result = unittest.TextTestRunner(stream=sys.stdout, verbosity=2).run(suite)
    summary = {
        "unitTests": result.testsRun,
        "negativeCases": NEGATIVE_CASES,
        "failures": len(result.failures),
        "errors": len(result.errors),
        "guardViolations": GUARD_VIOLATIONS,
        "actualAcquisitionInvoked": False,
        "actualWorkerInvoked": False,
        "productionPathsTouched": False,
    }
    print("MOCK_TEST_SUMMARY " + json.dumps(summary, sort_keys=True))
    sys.exit(0 if result.wasSuccessful() and not GUARD_VIOLATIONS else 1)
