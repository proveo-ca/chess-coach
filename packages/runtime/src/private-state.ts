// SPEC: _spec/checkpoint-runtime.puml, _spec/match-runtime.puml
import { createHash } from "node:crypto";
import { closeSync, constants, fsyncSync, lstatSync, mkdirSync, openSync, writeSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import type { ByteRef, JournalRef } from "../../contracts/src/training-state";
import { STORAGE_BOUNDS } from "./storage-bounds";

const MAX_FILE = 64 * 1024 * 1024, MAX_ATTEMPT = 512 * 1024 * 1024, MAX_PACKET = 4 * 1024 * 1024 * 1024, MAX_ENTRIES = 16384;
type Packet = { path: string; bytes: number; entries: number };
function syncDirectory(path: string): void {
  const fd = openSync(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
export class PrivateState {
  private failed = false;
  private bytes = 128 * 1024 * 1024;
  private entries = 4;
  private readonly packets = new Map<number, Packet>();
  private readonly attempts = new Map<string, { path: string; bytes: number; ordinal: number; packet: Packet }>();
  private readonly journal = createHash("sha256");
  private journalBytes = 0;
  private journalOrdinal = 0;
  constructor(readonly root: string, private readonly entriesPerPacket = MAX_ENTRIES) {
    if (!isAbsolute(root) || !Number.isSafeInteger(entriesPerPacket) || entriesPerPacket < 4 || entriesPerPacket > MAX_ENTRIES) throw new Error("Private state: PATH_OR_LIMITS");
    mkdirSync(root, { mode: 0o700 });
    if (!lstatSync(root).isDirectory()) throw new Error("Private state: DIRECTORY");
    syncDirectory(dirname(root));
  }
  databasePath(): string { return join(this.root, "private.sqlite"); }
  attempt(id: string, packetIndex = 0): string {
    this.live();
    try {
      if (!/^[A-Za-z0-9._:-]{1,32}$/.test(id) || this.attempts.has(id) || !Number.isSafeInteger(packetIndex) || packetIndex < 0 || packetIndex >= 50) throw new Error("Private state: ATTEMPT_REUSE_OR_ID");
      let packet = this.packets.get(packetIndex);
      if (packet === undefined) {
        const path = join(this.root, `packet-${String(packetIndex).padStart(2, "0")}`);
        mkdirSync(path, { mode: 0o700 });
        syncDirectory(this.root);
        packet = { path, bytes: packetIndex === 0 ? 128 * 1024 * 1024 : 0, entries: packetIndex === 0 ? 4 : 1 };
        this.packets.set(packetIndex, packet);
        if (packetIndex !== 0) this.entries++;
      }
      if (packet.entries + 1 > this.entriesPerPacket) throw new Error("Private state: ENTRY_BOUND");
      this.entries++; packet.entries++;
      const path = join(packet.path, `attempt-${id}`);
      mkdirSync(path, { mode: 0o700 });
      syncDirectory(packet.path);
      this.attempts.set(id, { path, bytes: 0, ordinal: 0, packet });
      return path;
    } catch (error) { this.failed = true; throw error; }
  }
  private live(): void { if (this.failed) throw new Error("Private state: CLOSED"); }
  write(id: string, role: string, bytes: Uint8Array): ByteRef {
    this.live();
    try {
      const attempt = this.attempts.get(id);
      if (!attempt || !/^[a-zA-Z0-9_-]{1,64}$/.test(role)) throw new Error("Private state: ROLE");
      const size = bytes.byteLength;
      if (size > MAX_FILE || attempt.bytes + size > MAX_ATTEMPT || attempt.packet.bytes + size > MAX_PACKET ||
        this.bytes + size > 50 * MAX_PACKET || attempt.packet.entries + 1 > this.entriesPerPacket) throw new Error("Private state: BYTE_OR_ENTRY_BOUND");
      this.bytes += size; attempt.bytes += size; attempt.packet.bytes += size; this.entries++; attempt.packet.entries++;
      const path = join(attempt.path, `${String(attempt.ordinal++).padStart(6, "0")}-${role}.bin`);
      const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
      try {
        let offset = 0;
        while (offset < size) {
          const count = writeSync(fd, bytes, offset, size - offset);
          if (count <= 0) throw new Error("Private state: SHORT_WRITE");
          offset += count;
        }
        fsyncSync(fd);
      } finally { closeSync(fd); }
      syncDirectory(attempt.path);
      return { byteLength: size, sha256: createHash("sha256").update(bytes).digest("hex") };
    } catch (error) { this.failed = true; throw error; }
  }
  appendJournal(id: string, auditJson: string): JournalRef {
    this.live();
    try {
      const lines = auditJson.split("\n");
      if (lines.pop() !== "" || lines.length === 0 || lines.length > STORAGE_BOUNDS.auditRecords || Buffer.byteLength(auditJson) > STORAGE_BOUNDS.auditBytes) throw new Error("Private state: JOURNAL_FRAME");
      const json = lines.map((line, ordinal) => {
        const value: unknown = JSON.parse(line);
        if (!value || typeof value !== "object" || Reflect.get(value, "ordinal") !== ordinal) throw new Error("Private state: JOURNAL_ORDINAL");
        return JSON.stringify({ recordOrdinal: this.journalOrdinal + ordinal + 1, attemptId: id, event: value });
      }).join("\n") + "\n";
      const bytes = Buffer.from(json);
      if (bytes.byteLength > STORAGE_BOUNDS.journalSegmentBytes) throw new Error("Private state: JOURNAL_SEGMENT_BOUND");
      this.write(id, "verified-journal", bytes);
      this.journal.update(bytes);
      this.journalBytes += bytes.byteLength;
      this.journalOrdinal += lines.length;
      return { byteLength: this.journalBytes, sha256: this.journal.copy().digest("hex"), lastRecordOrdinal: this.journalOrdinal };
    } catch (error) { this.failed = true; throw error; }
  }
  usage(): { byteLength: number; entries: number; packets: number; failed: boolean } { return { byteLength: this.bytes, entries: this.entries, packets: this.packets.size, failed: this.failed }; }
}
