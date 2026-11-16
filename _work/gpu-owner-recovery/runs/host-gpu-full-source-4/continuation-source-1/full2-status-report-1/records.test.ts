// SPEC: _spec/gpu-full-qualification.puml
import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const text = (path: string) => readFile(new URL(path, import.meta.url), "utf8");
const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const report = await text("./reported-status.txt"), observation = JSON.parse(await text("./observation.json"));
const request = JSON.parse(await text("./fresh-manual-host-request.json")), originalText = await text("../../host-command-request.json");
const original = JSON.parse(originalText), terminal = JSON.parse(await text("../terminal-submission-observation.json"));
const expectedReport = [
  "FULL2_PATH_ABSENT /home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/cache/host-gpu-full-2",
  "FULL2_PATH_ABSENT /home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/runs/host-gpu-full-2",
  "FULL2_CONTAINER_METADATA_BEGIN", "", "FULL2_CONTAINER_METADATA_END exit=0", "FULL2_RECEIPT_ABSENT", "FULL2_STATUS_ONLY_EXIT=0", "",
].join("\n");
const reportedAbsence = (value: string) => value === expectedReport;

test("complete pasted report establishes only reported current absence", () => {
  expect(report).toBe(expectedReport);
  expect(observation.status).toBe("PASS_REPORTED_STATUS_ONLY_FULL2_ABSENT_AT_QUERY");
  expect(observation.reported).toEqual({ workspaceAbsent: true, evidenceAbsent: true, matchingContainerRows: 0, receiptAbsent: true, dockerQueryExit: 0, statusMarkerExit: 0 });
  expect(observation.provenance).toBe("USER_PASTED_COMPLETE_STATUS_OUTPUT_NOT_ORIGINAL_HOST_BYTES");
  expect(observation.actualHostCommandBytesIndependentlyVerified).toBe(false);
  expect(observation.queryTimestamp).toBeNull();
});

test("missing markers, nonzero exits and container rows cannot establish the recorded absence", () => {
  for (const changed of [
    report.replace("FULL2_STATUS_ONLY_EXIT=0\n", ""), report.replace("FULL2_STATUS_ONLY_EXIT=0", "FULL2_STATUS_ONLY_EXIT=1"),
    report.replace("METADATA_END exit=0", "METADATA_END exit=1"), report.replace("METADATA_BEGIN\n\n", "METADATA_BEGIN\n012345 running\n"),
    report.replace("FULL2_RECEIPT_ABSENT", "FULL2_RECEIPT_BEGIN bytes=2\n{}"), report.replace("FULL2_PATH_ABSENT", "FULL2_PATH_PRESENT"),
  ]) expect(reportedAbsence(changed)).toBe(false);
});

test("current absence does not resolve the prior submission or renew its grant", () => {
  expect(terminal.remainingExistingOperatorHostInvocations).toBe(0);
  expect(terminal.hostExitCode).toBeNull(); expect(terminal.testsExecuted).toBeNull();
  expect(observation.previousFull2ExecutionOutcome).toBe("UNKNOWN");
  for (const field of ["previousFull2HostExitCode", "previousFull2GpuExecutionAttempted", "previousFull2TestsExecuted"]) expect(observation[field]).toBeNull();
  expect(observation.previousFull2GrantRemaining).toBe(0); expect(observation.newHostInvocationsAuthorized).toBe(0);
  expect(observation.automaticRetryAuthorized).toBe(false); expect(observation.fullSixQualified).toBe(false);
  expect(observation.trainingAuthorized).toBe(false); expect(observation.trainingReady).toBe(false);
});

test("status-command identity is a delivered binding and its separate allowance is consumed", async () => {
  const command = await readFile(new URL("../host-status-command.fish", import.meta.url));
  expect(command.length).toBe(observation.deliveredStatusCommand.bytes);
  expect(hash(command)).toBe(observation.deliveredStatusCommand.sha256);
  expect(observation.statusGrantConsumption.reportedInvocations).toBe(1);
  expect(observation.statusGrantConsumption.remainingInvocations).toBe(0);
  expect(observation.operatorReportedCheckout).toEqual({ provenance: "SEPARATE_USER_PASTED_HOST_GIT_LOG_NOT_INDEPENDENT_HOST_QUERY", branch: "feat-ml-adjuntant-ii", commit: "f6bce72a2cd10f66acf77162166a1d03fc87cd13" });
});

test("pending request binds the unchanged full-two command and historical source proof", async () => {
  expect(request.status).toBe("AWAITING_EXPLICIT_FRESH_APPROVAL");
  expect(hash(originalText)).toBe(request.originalRequest.sha256);
  expect(request.command).toEqual(original.command); expect(request.sourceProof).toEqual(original.sourceProof);
  const command = await readFile(new URL("../../host-command.fish", import.meta.url));
  expect(command.length).toBe(56981); expect(hash(command)).toBe(request.command.sha256);
  expect(hash(await text("../../receipt.json"))).toBe(request.sourceProof.sha256);
  expect(request.newSourceGenerationRequested).toBe(false); expect(request.commandRegenerationRequested).toBe(false);
});

test("fresh request retains original bounds and requests only one manual HOST attempt", () => {
  expect(request.manualExecution).toEqual({ cwd: original.operatorRepositoryRoot, argv: ["fish", "--no-config", original.command.path] });
  expect(request.runId).toBe(original.runId); expect(request.freshWritableRoots).toEqual(original.freshWritableRoots);
  expect(request.requested.maximumHostInvocations).toBe(original.maximumHostInvocations);
  expect(request.requested.maximumContainers).toBe(original.maximumContainers);
  expect(request.requested.maximumDockerOperations).toBe(original.maximumDockerOperations);
  expect(request.requested.exactGpuTests).toBe(original.exactGpuTests);
  expect(request.requested.finiteDifferenceCoordinates).toBe(original.finiteDifferenceCoordinates);
  expect(request.requested.overallMs).toBe(original.limits.overallMs);
  for (const field of ["cpus", "memoryBytes", "memoryPlusSwapBytes"]) expect(request.requested[field]).toBe(original.resources[field]);
  expect(request.requested.maximumPrintedReceiptBytes).toBe(original.limits.hostReceiptBytes);
  expect(request.requested.maximumManualInvocationTextDeliveries).toBe(1);
  expect(request.requested.unchangedOriginalRequestBoundsAndOperations).toBe(true);
  expect(request.requested.freshRootRefusalUnchanged).toBe(true);
  expect(request.requested.anyAttemptConsumesNewAllowanceIncludingPreflightFailure).toBe(true);
});

test("request preparation grants no execution, installation, copying, training or Git permission", () => {
  for (const [field, value] of Object.entries(request)) if (/Approved$|Authorized$/.test(field)) expect(value).toBe(false);
  expect(request.remainingApprovedHostInvocations).toBe(0);
  expect(request.previousFull2HostInvocationsRemaining).toBe(0); expect(request.previousStatusQueriesRemaining).toBe(0);
  expect(request.previousFull2ExecutionOutcome).toBe("UNKNOWN"); expect(request.trainingReady).toBe(false);
  expect(request.retainedInputsRemainReadOnly).toBe(true); expect(request.priorFailedWorkspacesAndEvidenceRetained).toBe(true);
});

test("separate fresh approval binds the issued request and grants one manual attempt", async () => {
  const approval = JSON.parse(await text("./fresh-manual-host-approval.json")), requestBytes = await readFile(new URL("./fresh-manual-host-request.json", import.meta.url));
  expect(approval.status).toBe("APPROVED_ONE_NEW_MANUAL_OPERATOR_HOST_FULL_TWO_ATTEMPT_UNOBSERVED");
  expect(approval.grantId).toBe("full2-manual-grant-1");
  expect(approval.request.bytes).toBe(requestBytes.length); expect(approval.request.sha256).toBe(hash(requestBytes));
  expect(approval.command).toEqual(request.command); expect(approval.originalRequest).toEqual(request.originalRequest);
  expect(approval.manualExecution).toEqual(request.manualExecution); expect(approval.runId).toBe(request.runId);
  expect(approval.maximumHostInvocations).toBe(1); expect(approval.remainingHostInvocations).toBe(1);
  expect(approval.hostInvocationObserved).toBe(false); expect(approval.maximumManualInvocationTextDeliveries).toBe(1);
  for (const field of ["manualInvocationTextDeliveryApproved", "hostExecutionApproved", "gpuExecutionApproved", "kernelJitExecutionApproved", "freshEmbeddedTextScratchEvidenceJitWritesApproved", "ownedContainerCleanupApproved", "unchangedOriginalRequestBoundsAndOperations", "anyAttemptConsumesNewAllowanceIncludingPreflightFailure"]) expect(approval[field]).toBe(true);
});

test("fresh approval preserves previous consumption, historical uncertainty and excluded operations", async () => {
  const approval = JSON.parse(await text("./fresh-manual-host-approval.json"));
  expect(approval.previousFull2ExecutionOutcome).toBe("UNKNOWN");
  expect(approval.previousFull2HostInvocationsRemaining).toBe(0); expect(approval.previousStatusQueriesRemaining).toBe(0);
  for (const field of ["automaticTerminalSubmissionAuthorized", "automaticRetryAuthorized", "nativeCompilationApproved", "acquisitionOrInstallationApproved", "retainedInputCopyingOrMutationApproved", "codingHostNativeGpuOrJitExecutionApproved", "gitOperationsApproved", "experimentTrainingApproved", "trainingReady"]) expect(approval[field]).toBe(false);
  expect(approval.retainedInputsRemainReadOnly).toBe(true); expect(approval.priorFailedWorkspacesAndEvidenceRetained).toBe(true);
});

test("one delivered invocation text does not establish a HOST attempt or leave another delivery", async () => {
  const delivered = JSON.parse(await text("./manual-delivery-observation.json")), approval = JSON.parse(await text("./fresh-manual-host-approval.json"));
  expect(delivered.approval.sha256).toBe(hash(await text("./fresh-manual-host-approval.json")));
  expect(delivered.grantId).toBe(approval.grantId); expect(delivered.invocationText).toBe(approval.manualExecution.argv.join(" "));
  expect(delivered.workingDirectory).toBe(approval.manualExecution.cwd);
  expect(delivered.manualInvocationTextDeliveriesConsumed).toBe(1); expect(delivered.remainingManualInvocationTextDeliveries).toBe(0);
  expect(delivered.hostInvocationObserved).toBe(false);
  for (const field of ["hostInvocationOccurred", "hostExitCode", "gpuExecutionAttempted", "testsExecuted"]) expect(delivered[field]).toBeNull();
  expect(delivered.generatedReceiptReceived).toBe(false); expect(delivered.automaticRetryAuthorized).toBe(false);
  expect(delivered.previousFull2GrantRemaining).toBe(0); expect(delivered.previousStatusQueriesRemaining).toBe(0);
});

test("publication approval targets only the continuation branch and renews no HOST authority", async () => {
  const publication = JSON.parse(await text("./publication-request.json"));
  expect(publication.parentCommit).toBe("2b24d9c5ab4a3904d792e93c83e0715a862ab3ea");
  expect(publication.expectedDestinationCommit).toBe(publication.parentCommit);
  expect(publication.destination).toBe("https://github.com/proveo-ca/chess-coach.git");
  expect(publication.destinationRef).toBe("refs/heads/feat-ml-adjuntant-ii-continuation-2b24d9c5a");
  expect(publication.maximumNormalCommits).toBe(1); expect(publication.maximumHttpsPushes).toBe(1);
  for (const field of ["originalRemoteFeatureBranchUpdateApproved", "mergeOrRebaseApproved", "forceAmendOrHookBypassApproved", "automaticRetryAuthorized", "hostInvocationOrDeliveryAllowanceRenewed", "nativeCompilationOrGpuExecutionApprovedByThisGrant", "installationOrCopyingApproved", "experimentTrainingApproved", "trainingReady"]) expect(publication[field]).toBe(false);
  expect(publication.scope.cachesAndBinariesExcluded).toBe(true); expect(publication.scope.regularTextFilesOnly).toBe(true);
});

test("reported unstarted attempt permits one post-publication text replacement without another GPU allowance", async () => {
  const redelivery = JSON.parse(await text("./manual-redelivery-approval.json")), approval = JSON.parse(await text("./fresh-manual-host-approval.json"));
  expect(redelivery.existingHostGrant.sha256).toBe(hash(await text("./fresh-manual-host-approval.json")));
  expect(redelivery.existingHostGrant.grantId).toBe(approval.grantId);
  expect(redelivery.reportedExistingFreshHostAttemptStatus).toBe("NOT_STARTED");
  expect(redelivery.reportedExistingHostInvocationsRemaining).toBe(1); expect(redelivery.newHostInvocationAllowanceIssued).toBe(0);
  expect(redelivery.previousFull2TerminalSubmissionOutcome).toBe("UNKNOWN");
  expect(redelivery.previousFull2HostGrantRemaining).toBe(0); expect(redelivery.previousInvocationTextDeliveriesRemaining).toBe(0);
  expect(redelivery.maximumReplacementInvocationTextDeliveries).toBe(1); expect(redelivery.remainingReplacementInvocationTextDeliveriesAtIssuance).toBe(1);
  expect(redelivery.replacementInvocationTextDeliveryApproved).toBe(true);
  expect(redelivery.successfulCurrentPacketCommitAndPushRequiredBeforeDelivery).toBe(true);
  expect(redelivery.command).toEqual(approval.command); expect(redelivery.manualExecution).toEqual(approval.manualExecution);
  expect(redelivery.unchangedExistingHostGrantBoundsAndOperations).toBe(true);
  expect(redelivery.anyHostAttemptConsumesExistingOneShotAllowanceIncludingPreflightFailure).toBe(true);
  for (const field of ["automaticRetryAuthorized", "newGpuExecutionAllowanceIssued", "nativeCompilationOrInstallationApproved", "retainedInputCopyingOrMutationApproved", "experimentTrainingApproved", "trainingReady"]) expect(redelivery[field]).toBe(false);
});
