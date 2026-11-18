# SPEC: _spec/supervision.puml
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tooling.runtime.evidence import EvidencePacket


class EvidenceTests(unittest.TestCase):
    def root(self):
        return (
            Path(
                tempfile.mkdtemp(
                    prefix="chess-coach-ii-evidence-fixture-", dir="/tmp/opencode"
                )
            )
            / "packet"
        )

    def test_exclusive_durable_files_use_exact_bytes_and_never_overwrite(self):
        root = self.root()
        packet = EvidencePacket(root, 16, 32, 8, 16)
        attempt = packet.attempt("synthetic")
        ref = attempt.write("started", b"STARTED")
        self.assertEqual((root / ref["path"]).read_bytes(), b"STARTED")
        self.assertEqual(ref["byteLength"], 7)
        self.assertEqual(ref["ordinal"], 0)
        self.assertEqual(packet.bytes, 7)
        with self.assertRaises(FileExistsError):
            EvidencePacket(root)
        with self.assertRaisesRegex(RuntimeError, "ATTEMPT_REUSE"):
            packet.attempt("synthetic")

    def test_file_attempt_packet_and_inode_exhaustion_fail_without_erasing_prior_bytes(
        self,
    ):
        for bound in ("file", "attempt", "packet", "entries"):
            with self.subTest(bound=bound):
                root = self.root()
                packet = EvidencePacket(
                    root,
                    8,
                    8 if bound == "packet" else 32,
                    3 if bound == "entries" else 16,
                    4 if bound == "file" else 8,
                )
                attempt = packet.attempt("first")
                ref = attempt.write("first", b"1234")
                if bound == "packet":
                    attempt = packet.attempt("second")
                with self.assertRaisesRegex(RuntimeError, "BOUND"):
                    attempt.write("second", b"5678" if bound == "entries" else b"56789")
                self.assertTrue(packet.failed)
                self.assertEqual((root / ref["path"]).read_bytes(), b"1234")
                with self.assertRaisesRegex(RuntimeError, "CLOSED"):
                    attempt.write("retry", b"x")

    def test_storage_failure_preserves_consumed_reservation_and_stops_all_attempts(
        self,
    ):
        root = self.root()
        packet = EvidencePacket(root, 16, 32, 16, 16)
        first = packet.attempt("first")
        second = packet.attempt("second")
        with patch(
            "tooling.runtime.evidence.os.fsync",
            side_effect=OSError("synthetic durability failure"),
        ):
            with self.assertRaisesRegex(OSError, "durability"):
                first.write("record", b"partial-durable")
        self.assertEqual(packet.bytes, len(b"partial-durable"))
        self.assertTrue(any(first.root.iterdir()))
        with self.assertRaisesRegex(RuntimeError, "CLOSED"):
            second.write("retry", b"x")

    def test_balanced_is_an_upper_bound_and_paths_are_owner_generated(self):
        with self.assertRaises(ValueError):
            EvidencePacket(self.root(), packet_bytes=8 * 1024 * 1024 * 1024)
        root = self.root()
        packet = EvidencePacket(root)
        attempt = packet.attempt("synthetic")
        with self.assertRaises(ValueError):
            attempt.write("../escape", b"x")
        self.assertTrue(packet.failed)


if __name__ == "__main__":
    unittest.main()
