// SPEC: _spec/gpu-feasibility.puml
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { validateReportedFeasibility } from "./contract";
import type { FeasibilityPlan } from "../../qualification/host-feasibility/plan";

const root = "_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/", hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const report = await readJson(root + "reported-receipt.json"), observation = await readJson(root + "observation.json");
const request = await readJson(observation.request), planPath = "_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/plan.json", plan: FeasibilityPlan = await readJson(planPath);
validateReportedFeasibility(report, request, plan, await readFile(root + "operator-summary.txt", "utf8"));
const check = (value: unknown, reason: string) => { if (!value) throw Error(reason); };
check(observation.status === "OPERATOR_REPORTED_PASS_GPU_F64_FEASIBILITY_PAIR_AUTHORITY_CONSUMED"
  && observation.provenance === "SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES"
  && observation.reportedHostExitCode === 0 && observation.reportedHostInvocationsConsumed === 1 && observation.remainingHostInvocations === 0, "REPORTED_OUTCOME_AND_CONSUMPTION_REQUIRED");
for (const field of ["reportedGpuFeasibilityPairPassed", "reportedSourceStabilityChecked", "reportedGuardComplete", "reportedOwnedContainerCleanupPassed", "previousPublicationGrantConsumed", "priorRequestsProofsFailedRecordsAndPartialWorkspacesRetained"]) check(observation[field] === true, "REPORTED_FACT_REQUIRED:" + field);
for (const field of ["automaticRetryAuthorized", "reportedSourceChanged", "originalHostFilesReceived", "originalHostArtifactBytesRehashedInCoding", "originalHostJournalBytesVerified", "actualOperatorCommandBytesIndependentlyVerified", "fullNumericalAndC12Qualified", "cpu39Qualified", "canonicalBothQualified", "integratedR4Qualified", "operationalTelemetryQualified", "fullAssuranceQualified", "coldJitQualified", "newHostReadsAuthorized", "newCopyingOrStagingAuthorized", "newGpuExecutionAuthorized", "newKernelJitExecutionAuthorized", "newPublicationAuthorized", "trainingAuthorized", "trainingReady"]) check(observation[field] === false, "NO_NEW_AUTHORITY_OR_ASSURANCE_CLAIM:" + field);
check(observation.operatorSourceCommit === null && observation.reportedTestsExecuted === 2 && observation.reportedEachTestPassCount === 1 && observation.reportedEachTestFailCount === 0 && observation.reportedEachTestIgnoredCount === 0
  && observation.reportedArtifactsAdmitted === 5 && observation.reportedTelemetryQueriesPassed === 2 && observation.reportedTelemetrySamples === 2
  && observation.reportedHostElapsedMs === report.elapsedMs && observation.reportedInnerElapsedMs === report.innerReceipt.elapsedMs
  && observation.reportedJournalEvents === 8 && observation.reportedJournalBytes === 1476, "REPORTED_SCOPED_FACTS_REQUIRED");
check(hash(await readFile(request.command.path)) === request.command.sha256 && hash(await readFile(request.sourceProof.path)) === request.sourceProof.sha256
  && hash(await readFile(request.plan.path)) === request.plan.sha256, "ISSUED_PACKET_UNCHANGED_REQUIRED");
const issuedCheckPath = "_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/issued-approval-check.json", issuedCheck = await readJson(issuedCheckPath);
const requestBytes = await readFile(observation.request);
check(issuedCheck.request.path === observation.request && issuedCheck.request.bytes === requestBytes.length && issuedCheck.request.sha256 === hash(requestBytes), "ORIGINAL_ISSUED_REQUEST_UNCHANGED_REQUIRED");
const publication = await readJson(observation.publicationResult);
check(publication.status === "PASS_SOURCE_FOUR_NORMAL_COMMIT_AND_FIXED_HTTPS_PUSH" && publication.failure === null && publication.commit === observation.lastPublishedCommit
  && publication.normalCommitInvocationsConsumed === 1 && publication.fixedHttpsPushInvocationsConsumed === 1
  && publication.remainingNormalCommits === 0 && publication.remainingHttpsPushes === 0, "SEPARATE_PUBLICATION_ALLOWANCE_CONSUMED_REQUIRED");
const sourceProof = await readJson(request.sourceProof.path);
for (const row of sourceProof.sources) check(hash(await readFile(row.path)) === row.sha256, "FROZEN_SOURCE_CHANGED:" + row.path);
const paths = ["operator-summary.txt", "reported-receipt.json", "observation.json", "contract.ts", "verify-report.test.ts", "verify-report.ts"].map(path => root + path)
  .concat([observation.request, planPath, request.command.path, request.sourceProof.path, observation.publicationResult]);
paths.push(issuedCheckPath);
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
const inner = report.innerReceipt, uniqueCapturePaths = new Set([...inner.results, ...inner.telemetry.queries, ...report.results].flatMap(row => row.streams.map((stream: any) => stream.path)));
await writeFile(root + "record-check.json", JSON.stringify({ status: "PASS_OPERATOR_REPORTED_GPU_F64_FEASIBILITY_RECORDS_ONLY", sources, protectedSourceHashesChecked: sourceProof.sources.length,
  reportedHostExitCode: 0, reportedExactTestsPassed: 2, reportedNativeArgvChecked: 2, reportedTelemetryArgvChecked: 2, reportedCompleteDockerArgvChecked: 5,
  reportedCaptureMetadataRows: 28, reportedUniqueCapturePaths: uniqueCapturePaths.size, reportedArtifactMetadataEntries: 5, reportedSamplesCheckedAgainstFunctionalGuard: 2,
  reportedFreeMemoryMiB: inner.telemetry.samples.map((row: any) => row.freeBytes / 1048576), reportedJournalMetadata: inner.telemetry.events,
  reportedHostElapsedMs: report.elapsedMs, reportedInnerElapsedMs: inner.elapsedMs, hostInvocationsRemaining: 0, publicationInvocationsRemaining: 0,
  originalHostFilesReceived: false, originalHostArtifactBytesRehashedInCoding: false, originalHostJournalBytesVerified: false, actualOperatorCommandBytesIndependentlyVerified: false,
  codingHostDockerOrNativeGpuOperationsPerformed: false, newGpuOrJitExecutionAuthorized: false, newPublicationAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_OPERATOR_REPORTED_GPU_F64_FEASIBILITY_RECORDS_ONLY: exact pair, same-container scalar telemetry, successful cleanup; HOST grant consumed");
