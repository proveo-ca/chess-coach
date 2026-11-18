// SPEC: _spec/checkpoint-runtime.puml
const MIB = 1024 * 1024, GIB = 1024 * MIB;
export const STORAGE_BOUNDS = Object.freeze({
  attempts: 5000, packets: 50, packetBytes: 4 * GIB, packetEntries: 16384,
  auditRecords: 512, auditBytes: 16 * MIB, journalSegmentBytes: 17 * MIB, historyBytes: 16 * MIB,
  nativeRecordBytes: MIB, configBytes: 4096, startedBytes: 4096,
  databaseReservationBytes: 128 * MIB, abortDiagnosticBytes: 64 * MIB,
  initialModelsBytes: 5 * (MIB + 4096),
  finalModelPairsBytes: 5 * (MIB + 4096), experimentBytes: MIB,
  outsideEvidenceBytes: 4 * GIB, filesystemHeadroomBytes: 8 * GIB,
});
export function storageAdmissionBound() {
  const bound = STORAGE_BOUNDS;
  const perAttemptBytes = bound.journalSegmentBytes + bound.historyBytes + bound.nativeRecordBytes + bound.configBytes + bound.startedBytes;
  const privatePipelineBytes = bound.attempts * perAttemptBytes + bound.databaseReservationBytes + bound.abortDiagnosticBytes + bound.initialModelsBytes + bound.finalModelPairsBytes + bound.experimentBytes;
  return { perAttemptBytes, privatePipelineBytes, combinedPayloadBytes: privatePipelineBytes + bound.outsideEvidenceBytes,
    requiredUsableBytes: privatePipelineBytes + bound.outsideEvidenceBytes + bound.filesystemHeadroomBytes,
    requiredFreeEntries: (bound.packets + 1) * bound.packetEntries + 16,
    configuredPrivateCeilingBytes: bound.packets * bound.packetBytes };
}
