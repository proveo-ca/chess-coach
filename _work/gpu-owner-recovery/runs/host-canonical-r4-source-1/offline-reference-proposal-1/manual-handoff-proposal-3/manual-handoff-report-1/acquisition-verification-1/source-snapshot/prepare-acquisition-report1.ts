// SPEC: _spec/manual-handoff-implementation-3.puml
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { D, P, S, R, RECEIPT_SHA, EMPTY_SHA, json, read, encode, identity, pin, emit, validate } from "./acquisition-report1.ts";

const binding = json(`${S}/execution-binding3.json`), ready = json(`${P}/invocation-ready3.json`);
assert.equal(pin(`${S}/execution-binding3.json`).sha256, "f5a2dd1946213fbe42760db14011ccc6afab5909e659016d47b72f369a3a266c");
assert.equal(pin(`${P}/invocation-ready3.json`).sha256, "499cd2f22c554dd7349498cc4bdc101650489500c723822ad375457260699246");
const expectedIdentity = { ...binding.sourceIdentity,
  proof3Identity: { path: `${S}/fullverification-6/proof.json`, sha256: "8d1ef28d5e90cfb921ad5af31dbbf6fbeb00909ad669de8bd9724c64221415e5" },
  executionBindingSha256: "f5a2dd1946213fbe42760db14011ccc6afab5909e659016d47b72f369a3a266c" };
const attempt = { attemptId: "9b591592089a9c33907150fd2f68cdea", supervisorPid: 1684053,
  supervisorDomain: "9b591592089a9c33907150fd2f68cdea:supervisor:1684053", origin: 26, workDeadline: 108026, operationDeadline: 120026,
  grantId: "reference-two-package-source-acquisition-2", combinedAttemptsConsumed: 1, remainingCombinedAttempts: 0, automaticRetryAuthorized: false };
const receipt = { version: "chess-coach.bun-acquisition-receipt.v1", grantId: attempt.grantId,
  attemptId: attempt.attemptId, supervisorPid: attempt.supervisorPid, supervisorDomain: attempt.supervisorDomain, origin: 26, workDeadline: 108026, operationDeadline: 120026,
  terminalState: "FAIL", failure: "absolute-deadline", identity: expectedIdentity,
  combinedAttemptsConsumed: 1, remainingCombinedAttempts: 0, urlStartsConsumed: 1, confirmedGetInvocations: 1, actualGetRequests: 1, responsesCompleted: 1, urlsCompleted: 0,
  remainingGetSlots: 1, automaticRetryAuthorized: false, workerReaped: true, workerExitCode: null, termSent: true, killSent: false, termAttempted: true, killAttempted: false,
  reapingUnresolved: false, clockFailure: false, cleanupFailure: false, pipesDestroyed: true, journalCloseAttempted: true, journalClosed: true,
  doneEvidenceReceived: false, artifactsPreserved: true, retriesPerformed: 0, eligibilityRevalidated: true, workerStdoutEof: false, workerStderrEof: false,
  selectedHashesAndMembershipVerified: false, bindingRechecked: true, selectedManifestSha256: null, workerPid: 1684068,
  workerDomain: "9b591592089a9c33907150fd2f68cdea:worker:1684068",
  workerTiming: { clockDomain: "9b591592089a9c33907150fd2f68cdea:worker:1684068", workerStartMonoMs: 26, requestStartsMonoMs: [44] },
  deadlineSnapshot: { clockDomain: attempt.supervisorDomain, observedMonoMs: 30177, operationDeadlineMonoMs: 120026, observedExceeded: false },
  interrupted: false, strictOsSchedulingOrDurabilityDeadlineGuarantee: false, trainingReady: false, offlineSynthetic: false };
const observation = { version: "chess-coach.bun-invocation-observation.v1", phase: "POST_OPERATION", offlineSynthetic: false,
  invocationInstanceId: "431246a93a5a30071019d9a7d958e09a", callerPid: 1684027, clockDomain: "431246a93a5a30071019d9a7d958e09a:outer:1684027", assessment: "FAIL",
  expectedIdentity, readiness: { readySha256: "499cd2f22c554dd7349498cc4bdc101650489500c723822ad375457260699246", invocationProof: ready.invocationProof,
    captureProof: ready.captureProof, hashes: ready.hashes, identitySha256: ready.identitySha256 },
  runner: { status: "FAIL", exitCode: 1, failure: null, stdoutBytes: 0, stderrBytes: 0 }, runnerThrown: null, clockFailure: null,
  outerWitness: { clockDomain: "431246a93a5a30071019d9a7d958e09a:outer:1684027", exitCode: 1, stdoutEof: false, stderrEof: false, stderrBytes: 0,
    startedMonoMs: 25, completionObservedMonoMs: 30270, timedOut: false }, startedMonoMs: 25, completionObservedMonoMs: 30270,
  receiptSha256: RECEIPT_SHA, stdoutSha256: EMPTY_SHA, stderrObservedBytes: 0, failures: [], automaticRetryAuthorized: false, retriesPerformed: 0,
  captureConsumptionInferredFromLaunch: false, postWritesWithinOperationDeadlineClaimed: false, trainingReady: false };
const artifacts = [
  { role: "observation", reportedPath: `/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/runs/reference-package-handoff-3/snapshot/${P}/acquisition-invocation-1/observation.json`, reportedBytes: 21494, value: observation },
  { role: "attempt", reportedPath: `/home/gu1lty/Projects/proveo/chess-coach/${D}/package-acquisition-proposal-2/acquisition-execution-1/attempt.json`, reportedBytes: 353, value: attempt },
  { role: "receipt", reportedPath: `/home/gu1lty/Projects/proveo/chess-coach/${D}/package-acquisition-proposal-2/acquisition-execution-1/consumption-receipt.json`, reportedBytes: 17825, value: receipt }
];
for (const artifact of artifacts) assert.equal(encode(artifact.value).length, artifact.reportedBytes);
const result = validate(observation, attempt, receipt, encode(receipt));
const baselineRoot = `${R}/spec-baseline3`;
const priorReportNames = ["operator-console.report.txt", "operator-report.json", "consumption.json", "report-validation1.json", "triage-plan1.json", "validate-report1.ts",
  "private-outcome.report.json", "diagnostic-report-1.json", "consumption-clarification-1.json", "validate-diagnostic1.ts", "diagnostic-validation1.json"];
const seal = json(`${P}/seal-task-1/handoff2.json`), delivery = json(`${P}/delivery-task-1/handoff3.json`);
const preservedPaths = [...priorReportNames.map(name => `${R}/${name}`), ...Object.keys(ready.hashes.source), ...Object.keys(ready.hashes.caller), ...Object.keys(ready.hashes.observer),
  ...delivery.sourceFiles.map((item: { path: string }) => item.path), ...seal.sourceFiles.map((item: { path: string }) => item.path), ...seal.sevenDerivedRecords.map((item: { path: string }) => item.path),
  ...["approval3.json", "delivery-observation-correction3.json", "source-packet3.json", "operator-command3.fish", "packet-publication3.json", "command-publication3.json"].map(name => `${P}/${name}`)];
const preserved = [...new Set<string>(preservedPaths)].map(pin);
for (const group of [delivery.sourceFiles, seal.sourceFiles, seal.sevenDerivedRecords]) for (const item of group) assert.deepEqual(pin(item.path), item);
for (const group of Object.values(ready.hashes) as Record<string, string>[]) for (const [path, sha256] of Object.entries(group)) assert.equal(pin(path).sha256, sha256);
assert.equal(pin(`${R}/report-validation1.json`).sha256, "cbb1146400b8fdae5372f453ffe4fea67a6f74ad4b3a12ec03c34c6305ebfa69");
assert.equal(pin(`${R}/diagnostic-validation1.json`).sha256, "8dfe0bbd7cddba6cc48ebb83bc967d272c49cd06a35f413512a2077f4ef9ddf2");
fs.mkdirSync(baselineRoot, { mode: 0o700 });
const goals = ["_spec/manual-handoff-implementation-3.puml", "_spec/.spec-index.json", "_spec/runtime-protocol.puml"].map((path, i) => ({ originalPath: path,
  ...emit(`${baselineRoot}/${["spec-goal.puml", "spec-index.json", "runtime-discovery.puml"][i]}`, read(path)) }));
emit(`${baselineRoot}/manifest.json`, { version: "chess-coach.h3-acquisition-report-baseline.v1", nonAuthorizing: true, goals, preserved });
const records = artifacts.map(({ value, ...artifact }) => ({ ...artifact, reportedType: "regular file",
  representation: "RECONSTRUCTED_FROM_REPORTED_FIELDS_AND_MATCHING_FROZEN_METADATA", originalHostByteCapture: false,
  localReconstruction: emit(`${R}/${artifact.role}.report.json`, encode(value)) }));
emit(`${R}/acquisition-diagnostic-report-1.json`, { version: "chess-coach.h3-acquisition-diagnostic-report.v1", evidenceScope: "REPORT", nonAuthorizing: true,
  originalsAreHostByteCaptures: false, reportSource: "GENUINE_EXECUTOR_MESSAGE", artifacts: records,
  reconstructionMetadata: [pin(`${S}/execution-binding3.json`), pin(`${P}/invocation-ready3.json`)],
  reportedObserverReceiptSha256: RECEIPT_SHA, receiptReconstructionMatchesReportedObserverHash: true,
  observationAndAttemptOriginalHostHashesReported: false,
  supplements: [`${R}/operator-report.json`, `${R}/diagnostic-report-1.json`, `${R}/consumption-clarification-1.json`],
  newAllowancesAdded: 0, actualHostOrAcquisitionExecutedByReconstruction: false, executionReadinessClaimed: false, trainingReady: false });
emit(`${R}/consumption-clarification-2.json`, { version: "chess-coach.h3-consumption-report-clarification.v2", evidenceScope: "REPORT", nonAuthorizing: true,
  supplements: [`${R}/consumption.json`, `${R}/consumption-clarification-1.json`], evidence: `${R}/acquisition-diagnostic-report-1.json`,
  h3Remaining: { handoffAttempts: 0, anonymousSourceGets: 0 }, innerGrantId: attempt.grantId,
  innerCeilingUnchanged: { combinedAttempts: 1, npmGetRequests: 2, npmGetRequestsPerUrl: 1 },
  combinedAttemptsConsumed: 1, remainingCombinedAttempts: 0, urlStartsConsumed: 1, confirmedGetInvocations: 1, actualGetRequests: 1,
  responsesCompleted: 1, urlsCompleted: 0, remainingGetSlots: 1, unusedGetSlotAuthorizesAnotherCombinedAttempt: false,
  automaticRetryAuthorized: false, retriesPerformed: 0, priorUnknownAtReportTimeFieldsRewritten: false,
  renewedRefundedRetargetedOrNewAllowances: 0, retryReplayAdoptionOrContinuationAuthorized: false, trainingReady: false });
process.stdout.write(JSON.stringify({ ...result, records: records.map(record => record.localReconstruction), baseline: pin(`${baselineRoot}/manifest.json`) }) + "\n");
