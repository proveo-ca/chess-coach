// SPEC: _spec/manual-handoff-implementation-3.puml
import assert from "node:assert/strict";
import { P, S, R, json, read, identity, pin, emit, validate, type RecordValue } from "./acquisition-report1.ts";

const report = json(`${R}/acquisition-diagnostic-report-1.json`), clarification = json(`${R}/consumption-clarification-2.json`);
assert.equal(report.evidenceScope, "REPORT"); assert.equal(report.nonAuthorizing, true); assert.equal(report.originalsAreHostByteCaptures, false);
assert.equal(report.newAllowancesAdded, 0); assert.equal(report.actualHostOrAcquisitionExecutedByReconstruction, false); assert.equal(report.trainingReady, false);
assert.equal(report.artifacts.length, 3);
for (const artifact of report.artifacts as RecordValue[]) {
  assert.equal(artifact.originalHostByteCapture, false); assert.equal(artifact.reportedType, "regular file");
  assert.equal(artifact.representation, "RECONSTRUCTED_FROM_REPORTED_FIELDS_AND_MATCHING_FROZEN_METADATA");
  assert.deepEqual(pin(artifact.localReconstruction.path), artifact.localReconstruction);
  assert.equal(artifact.reportedBytes, artifact.localReconstruction.bytes);
}
for (const metadata of report.reconstructionMetadata) assert.deepEqual(pin(metadata.path), metadata);
const observation = json(`${R}/observation.report.json`), attempt = json(`${R}/attempt.report.json`), receipt = json(`${R}/receipt.report.json`);
const checks = validate(observation, attempt, receipt, read(`${R}/receipt.report.json`));
const binding = json(`${S}/execution-binding3.json`), expected = { ...binding.sourceIdentity,
  proof3Identity: { path: `${S}/fullverification-6/proof.json`, sha256: "8d1ef28d5e90cfb921ad5af31dbbf6fbeb00909ad669de8bd9724c64221415e5" },
  executionBindingSha256: "f5a2dd1946213fbe42760db14011ccc6afab5909e659016d47b72f369a3a266c" };
assert.deepEqual(observation.expectedIdentity, expected);
assert.equal(observation.readiness.identitySha256, "74d15873c0491903ac8129d97d42ad4705b323acb274303c71b49a7a1903f344");
const ready = json(`${P}/invocation-ready3.json`);
assert.deepEqual(observation.readiness, { readySha256: pin(`${P}/invocation-ready3.json`).sha256, invocationProof: ready.invocationProof,
  captureProof: ready.captureProof, hashes: ready.hashes, identitySha256: ready.identitySha256 });
assert.equal(clarification.combinedAttemptsConsumed, 1); assert.equal(clarification.remainingCombinedAttempts, 0);
assert.equal(clarification.actualGetRequests, 1); assert.equal(clarification.remainingGetSlots, 1); assert.equal(clarification.responsesCompleted, 1); assert.equal(clarification.urlsCompleted, 0);
assert.equal(clarification.unusedGetSlotAuthorizesAnotherCombinedAttempt, false); assert.equal(clarification.retryReplayAdoptionOrContinuationAuthorized, false);
assert.equal(clarification.priorUnknownAtReportTimeFieldsRewritten, false); assert.equal(clarification.renewedRefundedRetargetedOrNewAllowances, 0);
const outcome = json(`${R}/private-outcome.report.json`); assert.equal(outcome.callerChild.pid, observation.callerPid);
assert.equal(outcome.callerChild.outEOF, true); assert.equal(outcome.callerChild.errEOF, true); assert.equal(outcome.callerChild.signalFailure, true);
const baseline = json(`${R}/spec-baseline3/manifest.json`);
assert.equal(pin(`${R}/spec-baseline3/manifest.json`).sha256, "aa2c1f66af222a7d94a376a12892adc2f066885d4b50252e3e457f0e473f3d97");
for (const item of baseline.preserved) assert.deepEqual(pin(item.path), item);
for (const name of ["spec-baseline1", "spec-baseline2", "spec-baseline3"]) for (const item of json(`${R}/${name}/manifest.json`).goals) {
  assert.deepEqual(identity(read(item.path)), { bytes: item.bytes, sha256: item.sha256, gitBlobOid: item.gitBlobOid });
}
const source = read(`${S}/capture.ts`).toString("utf8");
assert(source.includes('this.completed++; this.deadline = this.marker.workDeadline;'));
assert(source.indexOf('deps.event("RESPONSE_COMPLETED"') < source.indexOf('requireThat(sri(data) === spec.integrity'));
const result = { ...checks, diagnosticReport: pin(`${R}/acquisition-diagnostic-report-1.json`), consumptionClarification: pin(`${R}/consumption-clarification-2.json`),
  artifacts: report.artifacts.map((item: RecordValue) => item.localReconstruction),
  preservedFiles: baseline.preserved.length, goalGenerationsPreserved: 3,
  source23Helpers2Seal6SevenRecordsAndPublicationBytesUnchanged: true,
  originalReportUnknownsPreserved: true, deliveryCallerEofAndObserverCaptureEofAreDifferentWitnesses: true,
  responseCompletionDoesNotEstablishSriExtractionOrUrlDone: true,
  exactBlockingInstruction: "UNRESOLVED", perUrlDeadlineCause: "INFERENCE_PENDING_EXISTING_JOURNAL_REPORT",
  actualHostNetworkNativeGpuLlvmAssemblyOrTrainingPerformed: false, newAllowancesAdded: 0 };
assert(process.argv.length === 3 && ["--check", "--emit-exclusive"].includes(process.argv[2]!));
if (process.argv[2] === "--emit-exclusive") emit(`${R}/acquisition-validation1.json`, result);
process.stdout.write(JSON.stringify(result) + "\n");
