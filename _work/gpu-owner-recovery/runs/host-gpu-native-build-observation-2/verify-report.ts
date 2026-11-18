// SPEC: _spec/gpu-host-build-reuse.puml
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { validateReportedBuildTwo } from "./contract";
import type { ReusePlan } from "../../qualification/host-build-reuse/plan";

const root = "_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const report = JSON.parse(await readFile(root + "reported-receipt.json", "utf8")), observation = JSON.parse(await readFile(root + "observation.json", "utf8"));
const request = JSON.parse(await readFile(observation.request, "utf8"));
const planPath = "_work/gpu-owner-recovery/runs/host-gpu-cache-reuse-source-3/plan.json", plan: ReusePlan = JSON.parse(await readFile(planPath, "utf8"));
validateReportedBuildTwo(report, request, plan, await readFile(root + "operator-summary.txt", "utf8"));
if (observation.status !== "OPERATOR_REPORTED_PASS_HOST_GPU_NATIVE_BUILD_ONLY" || observation.provenance !== "SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES" || observation.reportedHostExitCode !== 0 || observation.reportedHostInvocationsConsumed !== 1 || observation.remainingHostInvocations !== 0 || observation.reportedArtifactsAdmitted !== 5 || observation.reportedNativeCompilationPassed !== true || observation.reportedOwnedContainerCleanupPassed !== true) throw Error("REPORT_SCOPE_OBSERVATION_REQUIRED");
if (observation.reportedLearningCompilationPassed !== true || observation.reportedPolicyCompilationPassed !== true || observation.reportedSourceStabilityChecked !== true || observation.reportedSourceChanged !== false || observation.reportedHostElapsedMs !== report.elapsedMs || observation.reportedNativeElapsedMs !== report.nativeReceipt.elapsedMs || observation.previousPublicationGrantConsumed !== true || observation.partialHostWorkspaceAndCacheRetentionRequired !== true) throw Error("REPORTED_PARTIAL_FACTS_AND_RETENTION_SCOPE_REQUIRED");
for (const field of ["automaticRetryAuthorized", "originalHostFilesReceived", "originalHostArtifactBytesRehashed", "actualOperatorCommandBytesIndependentlyVerified", "newHostReadsAuthorized", "copyingOrStagingAuthorized", "nativeBuildRetryAuthorized", "newPublicationAuthorized", "gpuExecutionAuthorized", "kernelJitCompilationAuthorized", "trainingAuthorized", "trainingReady"]) if (observation[field] !== false) throw Error("NO_NEW_AUTHORITY_OR_INDEPENDENT_HOST_HASH_CLAIM:" + field);
if (hash(await readFile(request.sourceProof.path)) !== request.sourceProof.sha256 || hash(await readFile(request.command.path)) !== request.command.sha256) throw Error("ORIGINAL_PROOF_AND_COMMAND_UNCHANGED_REQUIRED");
const paths = ["reported-receipt.json", "operator-summary.txt", "observation.json", "contract.ts", "verify-report.test.ts", "verify-report.ts"].map(path => root + path).concat([observation.request, planPath, request.sourceProof.path, request.command.path]);
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(root + "record-check.json", JSON.stringify({ status: "PASS_OPERATOR_REPORTED_NATIVE_BUILD_TWO_RECORDS_ONLY", sources, reportedHostBuildStatus: report.status, reportedHostExitCode: 0,
  reportedNativeCommands: 5, reportedCargoCompilationsPassed: 2, reportedDockerOperations: 5, reportedCaptureMetadataRows: 20, reportedArtifactsAdmitted: report.artifacts,
  reportedNativeElapsedMs: report.nativeReceipt.elapsedMs, reportedHostElapsedMs: report.elapsedMs, reportedCleanupFailures: 0, hostInvocationsRemaining: 0,
  originalHostArtifactBytesRehashed: false, codingHostDockerOrNativeOperationsPerformed: false, gpuExecuted: false, newGpuOrJitExecutionAuthorized: false, newPublicationAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_OPERATOR_REPORTED_NATIVE_BUILD_TWO_RECORDS_ONLY: both compilations, five artifacts, successful cleanup; grant consumed");
