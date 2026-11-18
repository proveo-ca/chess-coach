// SPEC: _spec/checkpoint-runtime.puml
import { expect, test } from "bun:test";
import { STORAGE_BOUNDS, storageAdmissionBound } from "../src/storage-bounds";

test("fixed pipeline write bound is below a literal 200 GB disk without pretending the disk is allocated", () => {
  const bound = storageAdmissionBound();
  expect(bound.perAttemptBytes).toBe(35_659_776);
  expect(bound.privatePipelineBytes).toBe(178_511_781_888);
  expect(bound.combinedPayloadBytes).toBe(182_806_749_184);
  expect(bound.requiredUsableBytes).toBe(191_396_683_776);
  expect(bound.configuredPrivateCeilingBytes).toBe(200 * 1024 ** 3);
  expect(bound.privatePipelineBytes).toBeLessThan(bound.configuredPrivateCeilingBytes);
  expect(bound.requiredUsableBytes).toBeLessThan(200_000_000_000);
  expect(bound.requiredFreeEntries).toBe(835600);
  expect(100 * bound.perAttemptBytes + STORAGE_BOUNDS.databaseReservationBytes + STORAGE_BOUNDS.abortDiagnosticBytes + STORAGE_BOUNDS.initialModelsBytes + STORAGE_BOUNDS.finalModelPairsBytes + STORAGE_BOUNDS.experimentBytes)
    .toBeLessThan(STORAGE_BOUNDS.packetBytes);
});

test("declared audit record ceiling covers all native, permit and ACK stages without truncating retained evidence", () => {
  const nativeBoundaries = 2 * 64 + 1, decisions = 2 * 64, permits = 2 * 64, fixedAndStopRecords = 8;
  expect(nativeBoundaries + decisions + permits + fixedAndStopRecords).toBeLessThan(STORAGE_BOUNDS.auditRecords);
  expect(STORAGE_BOUNDS.auditBytes + STORAGE_BOUNDS.auditRecords * 256).toBeLessThan(STORAGE_BOUNDS.journalSegmentBytes);
});
