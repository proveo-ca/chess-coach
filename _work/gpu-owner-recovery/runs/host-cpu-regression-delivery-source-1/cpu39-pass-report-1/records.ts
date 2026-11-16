// SPEC: _spec/gpu-qualification.puml
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import input from "./reported-input.json";
import planSnapshot from "../../host-cpu-regression-source-2/plan.json";
import inventorySnapshot from "../../host-gpu-policy-record-correction-source-2/native-source-manifest.json";
import { acceptCpuWorker, cpuPaths, cpuWorkerCreate, type CpuPlan } from "../../../qualification/cpu-host";

export const reportRoot = "_work/gpu-owner-recovery/runs/host-cpu-regression-delivery-source-1/cpu39-pass-report-1/";
export const deliveryRoot = reportRoot.replace("cpu39-pass-report-1/", "");
export const hostRoot = "/home/gu1lty/Projects/proveo/chess-coach";
export const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const prefix = "/build/native/target-cpu/x86_64-unknown-linux-gnu/release/";
const guestEvidence = "/build/native/_work/gpu-owner-recovery/runs/host-cpu39-1";
const hostEvidence = hostRoot + "/_work/gpu-owner-recovery/runs/host-cpu39-1";
const emptyHash = hash("");
const inputSha256 = "6600db06b805f63e561bd4e56d4f2bc9f23aea13e6a4ce6b74ab304522e52673";
const approvalSha256 = "5e925919b5e3b227a846312b77c4765abf56abb2a3f25519be844b2e4792d9cb";
const streams = (directory: string, stdoutBytes: number, stderrBytes: number, stdoutHash: string, stderrHash: string) => [
  { path: directory + "/command.stdout", bytes: stdoutBytes, sha256: stdoutHash },
  { path: directory + "/command.stderr", bytes: stderrBytes, sha256: stderrHash },
];

export function normalizeReportedReceipt(raw = input, plan: CpuPlan = planSnapshot, inventory = inventorySnapshot) {
  const c = raw.common, command = { status: c.commandStatus, exitCode: c.commandExitCode, failure: c.failure };
  const artifacts = raw.artifacts.map(row => {
    assert.equal(row.length, 3); assert.equal(typeof row[0], "string"); assert.equal(typeof row[1], "number"); assert.equal(typeof row[2], "string");
    const [suffix, bytes, sha256] = row as [string, number, string];
    return { executable: prefix + suffix, bytes, sha256 };
  });
  const harnesses = raw.harnesses.map((row, index) => {
    assert.equal(row.length, 2); assert.equal(typeof row[0], "string"); assert.equal(typeof row[1], "number");
    const [id, count] = row as [string, number];
    return { id, executable: artifacts[index]!.executable, count };
  });
  const attempts = raw.nativeCaptures.map((row, index) => {
    assert.equal(row.length, 6); assert.equal(typeof row[0], "string");
    for (const field of row.slice(1, 4)) assert.equal(typeof field, "number");
    assert.equal(typeof row[4], "string"); assert.ok(row[5] === null || typeof row[5] === "string");
    const [id, timeoutMs, stdoutBytes, stderrBytes, stdoutHash, stderrHash] = row as [string, number, number, number, string, string | null];
    assert.ok(stderrHash !== null || stderrBytes === 0);
    const argv = index < 4 ? [...raw.nativeHeaderArgv[index]!] : [harnesses[index - 4]!.executable, ...raw.nativeHarnessArguments];
    return { id, argv, timeoutMs, attempted: c.nativeAttempted, commandInvoked: c.nativeCommandInvoked, ...command, stdoutBytes, stderrBytes,
      streams: streams(guestEvidence + "/" + id, stdoutBytes, stderrBytes, stdoutHash, stderrHash ?? emptyHash) };
  });
  const overrides: Record<string, number> = raw.outcomeByteOverrides;
  const outcomes = harnesses.map((harness, index) => ({ id: harness.id, ...command,
    stdoutBytes: overrides[harness.id] ?? attempts[index + 4]!.stdoutBytes, stderrBytes: attempts[index + 4]!.stderrBytes,
    accepted: c.outcomesAccepted, expectedCount: harness.count, executable: harness.executable, summaryCount: 1,
    stdoutSummaries: [`test result: ok. ${harness.count} passed; 0 failed; 0 ignored;`] }));
  const dockerArgv = [raw.dockerCreateArgv, ["docker", "--host=unix:///var/run/docker.sock", "start", raw.cid],
    ["docker", "--host=unix:///var/run/docker.sock", "logs", "--follow", raw.cid],
    ["docker", "--host=unix:///var/run/docker.sock", "container", "inspect", "--format", "{{json .State}}", raw.cid],
    ["docker", "--host=unix:///var/run/docker.sock", "rm", raw.cid]];
  const captures = raw.dockerCaptures.map(row => {
    assert.equal(row.length, 3); assert.equal(typeof row[0], "string"); assert.equal(typeof row[1], "number"); assert.equal(typeof row[2], "string");
    const [id, stdoutBytes, stdoutHash] = row as [string, number, string];
    return { id, streams: streams(hostEvidence + "/" + id, stdoutBytes, 0, stdoutHash, emptyHash) };
  });
  const results = captures.map((capture, index) => {
    const supervisorResult = { ...command, stdoutBytes: capture.streams[0]!.bytes, stderrBytes: capture.streams[1]!.bytes };
    return { id: capture.id, argv: [...dockerArgv[index]!], ...supervisorResult, supervisorResult: { ...supervisorResult } };
  });
  return { version: "chess-coach.cpu39-host.v1", status: c.hostStatus, failure: c.failure, cleanupFailures: [...c.cleanupFailures] as string[],
    cid: raw.cid, state: { ...raw.state }, innerReceipt: { version: "chess-coach.cpu39-worker.v1", status: c.workerStatus, failure: c.failure,
      phase: c.phase, failurePhase: c.failurePhase, staging: { inventory: structuredClone(inventory), copiedBytes: raw.copiedBytes, copiedFiles: raw.copiedFiles, sourceManifestSha256: raw.reportedInventorySnapshot.sha256 },
      sourceChanged: c.sourceChanged, sourceStabilityChecked: c.sourceStabilityChecked, sourceCheckFailure: c.sourceCheckFailure,
      sourceManifestSha256: raw.reportedInventorySnapshot.sha256, compilationAttempts: c.compilationAttempts, artifacts, harnesses,
      outcome: { status: c.outcomesAccepted ? "PASS_TESTS_ONLY" : "FAIL_TEST", results: outcomes }, results: attempts, elapsedMs: raw.workerElapsedMs,
      cpuOnly: c.cpuOnly, gpuExecuted: c.gpuExecuted, llvmExecuted: c.llvmExecuted, trainingExecuted: c.trainingExecuted, trainingReady: c.trainingReady },
    results, elapsedMs: raw.hostElapsedMs, hostInvocationsConsumed: c.hostInvocationsConsumed, remainingHostInvocations: c.remainingHostInvocations,
    automaticRetryAuthorized: c.automaticRetryAuthorized, cpuOnly: c.cpuOnly, gpuDevicesRequested: c.gpuDevicesRequested, gpuExecuted: c.gpuExecuted,
    trainingExecuted: c.trainingExecuted, trainingReady: c.trainingReady, workspaceIsFilesystemQuota: c.workspaceIsFilesystemQuota,
    dockerWritableLayerIncludedInWorkspaceAccounting: c.dockerWritableLayerIncludedInWorkspaceAccounting, limitsAreTrialCapsNotFitGuarantees: c.limitsAreTrialCapsNotFitGuarantees,
    captures, plan: structuredClone(plan), finalizationSignalObserved: c.finalizationSignalObserved, receiptStatusRequiresZeroHostMarker: c.receiptStatusRequiresZeroHostMarker };
}
export type Report = ReturnType<typeof normalizeReportedReceipt>;

export function validateReportedCpuPass(report: Report, plan: CpuPlan, hostExitCode: number) {
  assert.equal(hostExitCode, 0, "HOST_CPU39_EXIT0_REQUIRED");
  assert.equal(report.status, "PASS_HOST_CPU39_ONLY"); assert.equal(report.failure, null); assert.deepEqual(report.cleanupFailures, []);
  assert.equal(report.state.Status, "exited"); assert.equal(report.state.Running, false); assert.equal(report.state.ExitCode, 0); assert.equal(report.state.OOMKilled, false);
  assert.equal(report.hostInvocationsConsumed, 1); assert.equal(report.remainingHostInvocations, 0); assert.equal(report.automaticRetryAuthorized, false);
  assert.equal(report.finalizationSignalObserved, false); assert.equal(report.receiptStatusRequiresZeroHostMarker, true);
  assert.deepEqual(plan, planSnapshot); assert.deepEqual(report.plan, plan);
  acceptCpuWorker(report.innerReceipt);
  const inner = report.innerReceipt;
  assert.deepEqual(inner.staging.inventory, inventorySnapshot); assert.equal(inner.staging.copiedBytes, 663643); assert.equal(inner.staging.copiedFiles, 66);
  assert.equal(inner.staging.inventory.length, 65); assert.equal(inner.staging.sourceManifestSha256, plan.sourceManifestSha256);
  assert.deepEqual(report.results.map(row => row.id), ["worker-create", "worker-start", "worker-logs", "worker-state", "worker-remove"]);
  assert.deepEqual(report.results[0]!.argv, cpuWorkerCreate(cpuPaths(), 1000, 1000));
  for (const result of report.results) {
    assert.deepEqual(result.supervisorResult, { status: "PASS", exitCode: 0, failure: null, stdoutBytes: result.stdoutBytes, stderrBytes: result.stderrBytes });
    assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0); assert.equal(result.failure, null);
    assert.equal("timeoutMs" in result, false); assert.equal("captureFailures" in result, false);
  }
  for (const capture of report.captures) assert.equal("captureFailures" in capture, false);
  for (const value of [report, inner]) {
    assert.equal(value.cpuOnly, true); assert.equal(value.gpuExecuted, false); assert.equal(value.trainingExecuted, false); assert.equal(value.trainingReady, false);
  }
  assert.equal(inner.llvmExecuted, false); assert.equal(report.gpuDevicesRequested, false);
  assert.equal(report.workspaceIsFilesystemQuota, false); assert.equal(report.dockerWritableLayerIncludedInWorkspaceAccounting, false); assert.equal(report.limitsAreTrialCapsNotFitGuarantees, true);
  const metadataAnomalies = inner.outcome.results.flatMap((outcome, index) => {
    const attempt = inner.results[index + 4]!, stream = attempt.streams[0]!;
    return outcome.stdoutBytes === attempt.stdoutBytes && outcome.stdoutBytes === stream.bytes ? [] : [{
      kind: "OPERATOR_REPORTED_METADATA_ANOMALY", id: outcome.id, field: "stdoutBytes", outcomeStdoutBytes: outcome.stdoutBytes,
      nativeAttemptStdoutBytes: attempt.stdoutBytes, nativeStreamStdoutBytes: stream.bytes,
      disposition: "PRESERVED_VERBATIM_REPORT_ACCEPTED_BY_EXISTING_CPU_WORKER_PREDICATE_WITHOUT_BYTE_COUNT_AGREEMENT" }];
  });
  assert.deepEqual(metadataAnomalies, [{ kind: "OPERATOR_REPORTED_METADATA_ANOMALY", id: "policy-io:test:f32", field: "stdoutBytes", outcomeStdoutBytes: 192,
    nativeAttemptStdoutBytes: 179, nativeStreamStdoutBytes: 179,
    disposition: "PRESERVED_VERBATIM_REPORT_ACCEPTED_BY_EXISTING_CPU_WORKER_PREDICATE_WITHOUT_BYTE_COUNT_AGREEMENT" }]);
  assert.deepEqual(report, normalizeReportedReceipt(), "OPERATOR_LITERAL_FIELDS_MUST_REMAIN_UNCHANGED");
  return { acceptanceScope: "COMPLETE_OPERATOR_REPORT_AND_HOST_CPU39_EXIT0_ONLY", reportedCpuTests: 39, reportedLearningTests: 22, reportedPolicyTests: 17,
    reportedHarnesses: 16, reportedEmptyHarnesses: 5, reportedOfflineBuilds: 2, reportedNativeCommandsInvoked: 20, reportedCpuArtifacts: 19,
    reportedNativeSourceFiles: 65, reportedCopiedFiles: 66, reportedCopiedBytes: 663643, reportedDockerOperations: 5,
    fullMetadataConsistency: false, metadataAnomalyCount: metadataAnomalies.length, metadataAnomalies };
}

type ReportIO = { read(path: string): Promise<Uint8Array>; write(path: string, text: string): Promise<unknown> };
const localIO: ReportIO = { read: path => readFile(path), write: (path, text) => writeFile(path, text, { flag: "wx" }) };
export const snapshotPaths = [reportRoot + "reported-input.json", input.reportedPlanSnapshot.path, input.reportedInventorySnapshot.path, deliveryRoot + "approval.json",
  deliveryRoot + "publication-execution-1/publication-result.json", deliveryRoot + "publication-execution-1/manual-handoff-observation.json",
  deliveryRoot + "redelivery-1.json", deliveryRoot + "publication-redelivery-execution-1/publication-and-redelivery-result.json"];

export async function receiveReportedPass(io: ReportIO = localIO) {
  const snapshots = await Promise.all(snapshotPaths.map(async path => { const bytes = await io.read(path); return { path, bytes: bytes.length, sha256: hash(bytes), value: JSON.parse(Buffer.from(bytes).toString()) }; }));
  const [raw, plan, inventory, approval, publication, handoff, redeliveryApproval, redelivery] = snapshots;
  assert.equal(raw!.sha256, inputSha256); assert.deepEqual(raw!.value, input);
  assert.equal(plan!.sha256, input.reportedPlanSnapshot.sha256); assert.deepEqual(plan!.value, planSnapshot);
  assert.equal(inventory!.sha256, input.reportedInventorySnapshot.sha256); assert.deepEqual(inventory!.value, inventorySnapshot);
  assert.equal(input.reportedPlanSnapshot.operatorIncludedMatchingCompletePlan, true); assert.equal(input.reportedInventorySnapshot.operatorListedAll65MatchingPathHashes, true);
  assert.equal(approval!.sha256, approvalSha256); assert.equal(approval!.value.grantId, "cpu39-manual-grant-1");
  assert.equal(approval!.value.maximumCombinedManualHostAttempts, 1); assert.equal(approval!.value.maximumManualCommandTextDeliveries, 1);
  assert.equal(publication!.value.commit, "b6827cdc40305d641aff717f38cf85bfdfe326aa"); assert.equal(publication!.value.commitExitCode, 0); assert.equal(publication!.value.pushExitCode, 0);
  assert.equal(handoff!.value.grantId, approval!.value.grantId); assert.equal(handoff!.value.manualCommandTextDeliveriesConsumed, 1); assert.equal(handoff!.value.remainingManualCommandTextDeliveries, 0);
  assert.equal(redeliveryApproval!.value.grantId, "cpu39-receipt-publication-and-text-redelivery-1"); assert.equal(redeliveryApproval!.value.newHostAttemptOrRetryAuthorized, false);
  assert.equal(redelivery!.value.grantId, redeliveryApproval!.value.grantId); assert.equal(redelivery!.value.commit, "6fdc92c7eb90eb625e6d54c6a448009d5db34423");
  assert.equal(redelivery!.value.commitExitCode, 0); assert.equal(redelivery!.value.pushExitCode, 0);
  for (const value of [publication!.value, handoff!.value, redelivery!.value]) {
    assert.equal(value.normalCommitsConsumed, 1); assert.equal(value.remainingNormalCommits, 0); assert.equal(value.httpsPushesConsumed, 1); assert.equal(value.remainingHttpsPushes, 0);
  }
  assert.equal(redelivery!.value.exactTextRedeliveryAttemptsConsumed, 1); assert.equal(redelivery!.value.remainingExactTextRedeliveries, 0);
  const report = normalizeReportedReceipt(), facts = validateReportedCpuPass(report, plan!.value as CpuPlan, input.hostExitCode);
  assert.deepEqual(input.summary, { status: report.status, failure: report.failure, receipt: report.plan.evidence + "/receipt.json", trainingReady: report.trainingReady });
  assert.equal(input.provenance, "SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES");
  const bindings = snapshots.map(({ value: _value, ...binding }) => binding);
  const observation = { status: "OPERATOR_REPORTED_CPU39_PASS_WITH_METADATA_ANOMALY_CONSUMED", provenance: input.provenance, ...facts,
    reportedInput: bindings[0]!, reportedReceipt: reportRoot + "reported-receipt.json", operatorSummary: reportRoot + "operator-summary.txt",
    reportedHostExitCode: input.hostExitCode, reportedHostExitMarker: "HOST_CPU39_EXIT=0", issuedApproval: { ...bindings[3]!, grantId: approval!.value.grantId }, snapshots: bindings,
    normalization: { commonLiteralStatusesAndFlagsExpanded: true, operatorListedIdenticalInventoryExpandedFromBoundSnapshot: true,
      operatorIncludedCompletePlanExpandedFromBoundSnapshot: true, originalHostByteHashingPerformed: false,
      normalizedSummaryLinesOnly: true, rawNativeStdoutReconstructed: false, outerDockerTimeoutsNotSuppliedAndNotInvented: true,
      nativeCompilationTimeoutsMs: [1499999, 1349744], actualPerBuildElapsedMs: null, buildTimingInferredFromTimeoutDifference: false },
    sourceManifestSha256: report.innerReceipt.sourceManifestSha256, reportedSourceUnchanged: true, reportedCpu39Passed: true, reportedOwnedCleanupPassed: true,
    reportedHostElapsedMs: report.elapsedMs, reportedWorkerElapsedMs: report.innerReceipt.elapsedMs,
    grantId: approval!.value.grantId, maximumCombinedManualHostAttempts: 1, hostInvocationsConsumed: 1, remainingHostInvocations: 0,
    maximumNativeBuildInvocations: 2, nativeBuildInvocationsConsumed: 2, remainingNativeBuildInvocations: 0,
    manualCommandTextDeliveriesConsumed: 1, remainingManualCommandTextDeliveries: 0, normalCommitsConsumed: 1, remainingNormalCommits: 0, httpsPushesConsumed: 1, remainingHttpsPushes: 0,
    freshRedelivery: { grantId: redelivery!.value.grantId, publishedCommit: redelivery!.value.commit, normalCommitsConsumed: 1, remainingNormalCommits: 0,
      httpsPushesConsumed: 1, remainingHttpsPushes: 0, exactTextRedeliveryAttemptsConsumed: 1, remainingExactTextRedeliveries: 0, hostAttemptOrRetryRenewed: false },
    issuedSnapshotsAndCountersUnchanged: true, originalHostFilesReceived: false, originalCaptureOrJournalBytesReceived: false, originalCaptureOrJournalBytesRehashed: false,
    actualHostCommandBytesIndependentlyVerified: false, fullAssuranceQualified: false, reportAcceptanceRequiresOriginalByteCustody: false,
    cpu39QualifiedAtReportScope: true, cpuReportContainsGpuProof: false, previouslyAcceptedFullGpuAndC12ResultUnchanged: true,
    trialStorageFitDemonstratedForThisOneReportedRunOnly: true, readOnlyRegistryIndexCompatibilityDemonstratedForThisOneReportedRunOnly: true,
    generalStorageFitAssurance: false, generalReadOnlyRegistryCompatibilityAssurance: false, filesystemQuotaEstablished: false,
    canonicalBothQualified: false, referenceQualified: false, integratedR4Qualified: false, operationalWiringQualified: false,
    cpuRerunRequired: false, gpuRerunRequired: false, automaticRetryAuthorized: false, newHostOrNativeExecutionAuthorized: false, newGpuOrLlvmExecutionAuthorized: false,
    newPublicationAuthorized: false, newManualCommandDeliveryAuthorized: false, experimentTrainingAuthorized: false, trainingReady: false,
    hardeningPerformed: false, hardeningDeferredUntilAllPlannedTrainingCompleteAndResultsValidated: true };
  const summary = JSON.stringify(input.summary) + "\nHOST_CPU39_EXIT=" + input.hostExitCode + "\n";
  const files = { "reported-receipt.json": JSON.stringify(report, null, 2) + "\n", "operator-summary.txt": summary, "observation.json": JSON.stringify(observation, null, 2) + "\n" };
  for (const [name, text] of Object.entries(files)) {
    assert.ok(Buffer.byteLength(text) <= planSnapshot.limits.hostReceiptBytes);
    const path = reportRoot + name;
    try { assert.equal(Buffer.from(await io.read(path)).toString(), text, "IMMUTABLE_REPORT_RECORD_DIFFERS:" + name); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await io.write(path, text); }
  }
  return { report, summary, observation };
}

if (import.meta.main) {
  assert.deepEqual(Bun.argv.slice(2), ["--receive-report"], "EXACT_RECEIVE_REPORT_ARGUMENT_REQUIRED");
  assert.equal(process.execPath, "/usr/local/bin/bun"); assert.equal(Bun.version, "1.4.0"); assert.equal(process.cwd(), hostRoot);
  const { observation } = await receiveReportedPass();
  console.log(JSON.stringify({ status: "PASS_OPERATOR_REPORTED_CPU39_RECORDS_WITH_METADATA_ANOMALY_ONLY", reportedCpuTests: observation.reportedCpuTests, metadataAnomalyCount: observation.metadataAnomalyCount, trainingReady: false }));
}
