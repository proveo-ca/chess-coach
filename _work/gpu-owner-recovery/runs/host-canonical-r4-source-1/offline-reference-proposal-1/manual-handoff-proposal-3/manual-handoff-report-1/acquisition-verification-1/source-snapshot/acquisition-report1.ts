// SPEC: _spec/manual-handoff-implementation-3.puml
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { createHash } from "node:crypto";

export const D = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1";
export const P = `${D}/manual-handoff-proposal-3`, S = `${D}/package-acquisition-bun-source3`, R = `${P}/manual-handoff-report-1`;
export const RECEIPT_SHA = "7e030044a024fb973b359448847396b651b44a284d9556126bae46c8419dfe48";
export const EMPTY_SHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
export type RecordValue = Record<string, any>;
export function read(path: string): Buffer {
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd, { bigint: true }); assert(before.isFile() && before.size >= 0n && before.size <= 2n ** 21n);
    const buffer = Buffer.alloc(Number(before.size) + 1); let offset = 0;
    while (offset < buffer.length) { const count = fs.readSync(fd, buffer, offset, buffer.length - offset, null); if (!count) break; offset += count; }
    const after = fs.fstatSync(fd, { bigint: true }); assert.equal(offset, Number(before.size));
    for (const key of ["dev", "ino", "size", "mtimeNs", "ctimeNs"] as const) assert.equal(before[key], after[key]);
    return buffer.subarray(0, offset);
  } finally { fs.closeSync(fd); }
}
export const json = (path: string): RecordValue => JSON.parse(read(path).toString("utf8"));
export const encode = (value: unknown): Buffer => Buffer.from(JSON.stringify(value));
export const identity = (bytes: Buffer) => ({ bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), gitBlobOid: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") });
export const pin = (path: string) => ({ path, ...identity(read(path)) });
export function emit(path: string, value: unknown) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + "\n"); assert(bytes.length <= 2 ** 21);
  const fd = fs.openSync(path, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW | fs.constants.O_WRONLY, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return pin(path);
}
export function validate(observation: RecordValue, attempt: RecordValue, receipt: RecordValue, receiptBytes: Buffer) {
  assert.equal(observation.receiptSha256, RECEIPT_SHA);
  assert.equal(observation.version, "chess-coach.bun-invocation-observation.v1");
  assert.equal(receipt.version, "chess-coach.bun-acquisition-receipt.v1");
  assert.equal(observation.invocationInstanceId, "431246a93a5a30071019d9a7d958e09a"); assert.equal(observation.callerPid, 1684027);
  assert.equal(observation.clockDomain, `${observation.invocationInstanceId}:outer:${observation.callerPid}`);
  assert.equal(observation.assessment, "FAIL"); assert.equal(observation.offlineSynthetic, false);
  assert.deepEqual(observation.runner, { status: "FAIL", exitCode: 1, failure: null, stdoutBytes: 0, stderrBytes: 0 });
  assert.equal(observation.runnerThrown, null); assert.equal(observation.clockFailure, null); assert.deepEqual(observation.failures, []);
  assert.equal(observation.stdoutSha256, EMPTY_SHA); assert.equal(observation.stderrObservedBytes, 0);
  assert.equal(observation.outerWitness.clockDomain, observation.clockDomain); assert.equal(observation.outerWitness.timedOut, false);
  assert.equal(observation.outerWitness.exitCode, 1); assert.equal(observation.outerWitness.stdoutEof, false); assert.equal(observation.outerWitness.stderrEof, false);
  assert.equal(observation.outerWitness.stderrBytes, 0);
  assert.equal(observation.startedMonoMs, 25); assert.equal(observation.completionObservedMonoMs, 30270);
  assert.equal(observation.outerWitness.startedMonoMs, observation.startedMonoMs); assert.equal(observation.outerWitness.completionObservedMonoMs, observation.completionObservedMonoMs);
  assert.equal(attempt.attemptId, "9b591592089a9c33907150fd2f68cdea"); assert.equal(attempt.supervisorPid, 1684053);
  for (const key of ["attemptId", "supervisorPid", "supervisorDomain", "origin", "workDeadline", "operationDeadline", "grantId", "combinedAttemptsConsumed", "remainingCombinedAttempts", "automaticRetryAuthorized"]) assert.deepEqual(receipt[key], attempt[key]);
  assert.equal(attempt.supervisorDomain, `${attempt.attemptId}:supervisor:${attempt.supervisorPid}`);
  assert.equal(attempt.origin, 26); assert.equal(attempt.workDeadline, 108026); assert.equal(attempt.operationDeadline, 120026);
  assert.equal(attempt.grantId, "reference-two-package-source-acquisition-2");
  assert.equal(receipt.terminalState, "FAIL"); assert.equal(receipt.failure, "absolute-deadline"); assert.equal(receipt.offlineSynthetic, false);
  for (const key of ["combinedAttemptsConsumed", "urlStartsConsumed", "confirmedGetInvocations", "actualGetRequests", "responsesCompleted", "remainingGetSlots"]) assert.equal(receipt[key], 1);
  for (const key of ["remainingCombinedAttempts", "urlsCompleted", "retriesPerformed"]) assert.equal(receipt[key], 0);
  for (const key of ["workerReaped", "termSent", "termAttempted", "pipesDestroyed", "journalCloseAttempted", "journalClosed", "artifactsPreserved", "eligibilityRevalidated", "bindingRechecked"]) assert.equal(receipt[key], true);
  for (const key of ["killSent", "killAttempted", "reapingUnresolved", "clockFailure", "cleanupFailure", "doneEvidenceReceived", "workerStdoutEof", "workerStderrEof", "selectedHashesAndMembershipVerified", "interrupted", "strictOsSchedulingOrDurabilityDeadlineGuarantee"]) assert.equal(receipt[key], false);
  assert.equal(receipt.workerExitCode, null); assert.equal(receipt.selectedManifestSha256, null); assert.equal(receipt.workerPid, 1684068);
  assert.equal(receipt.workerDomain, `${attempt.attemptId}:worker:${receipt.workerPid}`);
  assert.deepEqual(receipt.workerTiming, { clockDomain: receipt.workerDomain, workerStartMonoMs: 26, requestStartsMonoMs: [44] });
  assert.deepEqual(receipt.deadlineSnapshot, { clockDomain: attempt.supervisorDomain, observedMonoMs: 30177, operationDeadlineMonoMs: 120026, observedExceeded: false });
  assert.notEqual(receipt.workerDomain, attempt.supervisorDomain); assert.notEqual(attempt.supervisorDomain, observation.clockDomain);
  assert.deepEqual(observation.expectedIdentity, receipt.identity);
  for (const value of [observation, receipt]) { assert.equal(value.trainingReady, false); assert.equal(value.automaticRetryAuthorized, false); assert.equal(value.retriesPerformed, 0); }
  assert.equal(attempt.automaticRetryAuthorized, false);
  assert.equal(receiptBytes.length, 17825); assert.equal(identity(receiptBytes).sha256, RECEIPT_SHA);
  assert.deepEqual(JSON.parse(receiptBytes.toString("utf8")), receipt);
  return { status: "PASS_REPORT_CONSISTENCY_NOT_HOST_QUALIFICATION", evidenceScope: "REPORT", receiptReconstructionMatchesReportedObserverHash: true,
    outerElapsedMs: observation.completionObservedMonoMs - observation.startedMonoMs,
    supervisorOperationCutoffExceededAtReportedSnapshot: false, clockDomainsComparedAcrossProcesses: false,
    remainingCombinedAttempts: 0, npmGetsConsumed: 1, unusedGetSlots: 1, retryAuthorized: false, trainingReady: false };
}
