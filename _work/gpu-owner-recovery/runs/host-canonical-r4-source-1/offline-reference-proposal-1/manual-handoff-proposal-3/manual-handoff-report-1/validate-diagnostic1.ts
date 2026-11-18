// SPEC: _spec/manual-handoff-implementation-3.puml
import * as fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createDeliveryRuntime } from "../delivery-bootstrap.ts";

const P = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1/manual-handoff-proposal-3", R = `${P}/manual-handoff-report-1`;
function read(path: string): Buffer {
  const fd = fs.openSync(path, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const before = fs.fstatSync(fd, { bigint: true }); assert(before.isFile() && before.size >= 0n && before.size <= 1048576n);
    const buffer = Buffer.alloc(Number(before.size) + 1); let offset = 0;
    while (offset < buffer.length) { const count = fs.readSync(fd, buffer, offset, buffer.length - offset, null); if (!count) break; offset += count; }
    const after = fs.fstatSync(fd, { bigint: true }); assert.equal(offset, Number(before.size));
    for (const key of ["dev", "ino", "size", "mtimeNs", "ctimeNs"] as const) assert.equal(before[key], after[key]); return buffer.subarray(0, offset);
  } finally { fs.closeSync(fd); }
}
const identity = (bytes: Buffer) => ({ bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), gitBlobOid: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") });
const json = (path: string): any => JSON.parse(read(path).toString("utf8"));
const pin = (path: string) => ({ path, ...identity(read(path)) });
function emit(path: string, value: unknown) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + "\n"); assert(bytes.length <= 1048576);
  const fd = fs.openSync(path, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW | fs.constants.O_WRONLY, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } return pin(path);
}
const originalValidation = json(`${R}/report-validation1.json`);
for (const item of [originalValidation.report, originalValidation.console, originalValidation.consumption]) assert.deepEqual(pin(item.path), item);
const outcome = json(`${R}/private-outcome.report.json`), diagnostic = json(`${R}/diagnostic-report-1.json`), clarification = json(`${R}/consumption-clarification-1.json`);
assert.equal(diagnostic.evidenceScope, "REPORT"); assert.equal(diagnostic.reportedFile.type, "regular file"); assert.equal(diagnostic.reportedFile.bytes, 3189);
assert.equal(outcome.failure, "caller-child:child-nonzero-or-signal"); assert.equal(outcome.stageB, true); assert.equal(outcome.sourceWriteAttempts, 66);
const source = outcome.sourceRequest, child = outcome.callerChild;
assert.equal(source.requestCalls, 1); assert.equal(source.statusCode, 200); assert.equal(source.failure, null);
assert.equal(source.body.bytes, 2351418); assert.equal(source.receivedBytes, source.body.bytes); assert.equal(source.retainedBytes, source.body.bytes);
for (const key of ["requestFinished", "requestClosed", "responseEOF", "responseComplete", "responseClosed", "socketClosed", "cleanupConfirmed"]) assert.equal(source[key], true);
for (const key of ["clockFailure", "cleanupFailure", "finalizationDeadlineExceeded", "aborted", "interrupted"]) assert.equal(source[key], false);
assert.equal(child.exitCode, 1); assert.equal(child.signal, null); assert.equal(child.pid, 1684027);
for (const key of ["spawnAttempted", "spawned", "reaped", "closed", "outEOF", "errEOF", "processGroupGone"]) assert.equal(child[key], true);
for (const key of ["spawnError", "noChildCreated", "interrupted", "cleanupExpired", "cleanupClockFailed", "finalizationDeadlineExceeded", "pipeCleanupFailed"]) assert.equal(child[key], false);
assert.equal(child.signalFailure, true); assert.deepEqual(child.signalAttempts, [{ target: "GROUP", signal: "SIGTERM", result: "THREW" }]);
assert.equal(child.cleanupConfirmed, false); assert.equal(child.pipeDestruction.cleanupCalls, 0); assert.equal(child.cleanupOriginsStarted, 1);
assert.deepEqual(child.stderr, identity(Buffer.alloc(0)));
const observation = `${P}/acquisition-invocation-1/observation.json`, derivedFailLine = Buffer.from(`FAIL ${observation}\n`);
assert.deepEqual(child.stdout, identity(derivedFailLine));
const api = await createDeliveryRuntime(); assert.equal(api.ownedCleanupConfirmed(true, source, true, child), false);
assert.equal(clarification.innerExclusiveClaimConsumption, "UNCONFIRMED_PENDING_EXISTING_ATTEMPT_OR_RECEIPT_REPORT");
assert.equal(clarification.deliveryFieldIsAnInnerAcquisitionClaimWitness, false); assert.equal(outcome.innerAttemptsConsumedByDelivery, 0);
assert.equal(pin(`${P}/delivery-bootstrap.ts`).sha256, "1e615287c481946283015a362f8ea4c4ce3dffaa86c26f6ddf73808fe346928a");
const baselineRoot = `${R}/spec-baseline2`; fs.mkdirSync(baselineRoot, { mode: 0o700 });
const goals = ["_spec/manual-handoff-implementation-3.puml", "_spec/.spec-index.json", "_spec/runtime-protocol.puml"].map((path, i) => ({ originalPath: path, ...emit(`${baselineRoot}/${["spec-goal.puml", "spec-index.json", "runtime-discovery.puml"][i]}`, read(path)) }));
const baseline = emit(`${baselineRoot}/manifest.json`, { version: "chess-coach.h3-private-outcome-report-goal-baseline.v1", nonAuthorizing: true, goals, originalReportRecordsUnchanged: true });
const result = emit(`${R}/diagnostic-validation1.json`, {
  version: "chess-coach.h3-private-outcome-report-validation.v1",
  status: "PASS_REPORT_SOURCE_TRANSPORT_CALLER_EXIT_AND_STDOUT_IDENTITY_CONSISTENCY",
  evidenceScope: "REPORT",
  outcome: pin(`${R}/private-outcome.report.json`), diagnostic: pin(`${R}/diagnostic-report-1.json`), consumptionClarification: pin(`${R}/consumption-clarification-1.json`),
  sourceRequestCalls: 1, sourceResponseBytes: 2351418, sourceTransportCleanupConfirmed: true,
  callerExitCode: 1, callerSignal: null, callerReapedClosedAndBothEof: true, callerProcessGroupReportedGone: true,
  callerCleanupRemainsUnconfirmed: true, recordedSignalFailure: true, signalErrnoKnown: false,
  derivedCallerFailLine: { observationPath: observation, identity: identity(derivedFailLine), matchesReportedStdoutIdentity: true, isAnOriginalHostStdoutCapture: false },
  originalReportAndConsumptionBytesPreserved: true, primaryApplicationFailureStillUnknown: true,
  innerExclusiveClaimAndNpmConsumption: "UNCONFIRMED", handoffBalance: 0, sourceGetBalance: 0,
  goalBaseline: baseline, actualHostOrAcquisitionExecutedByValidator: false, newAllowancesAdded: 0, trainingReady: false
});
process.stdout.write(JSON.stringify({ status: "PASS_H3_PRIVATE_OUTCOME_REPORT_VALIDATION", result, baseline, callerFailLineIdentityMatched: true, innerConsumption: "UNCONFIRMED", trainingReady: false }) + "\n");
