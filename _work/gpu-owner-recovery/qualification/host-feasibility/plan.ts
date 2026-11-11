// SPEC: _spec/gpu-feasibility.puml
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import base from "../host-build/plan.json";
import selection from "./selection.json";

export type ArtifactBinding = { executable: string; path: string; bytes: number; sha256: string };
export const buildObservation = "_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/observation.json";
export const buildReport = "_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-2/reported-receipt.json";
export const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const requireValue: (value: unknown, reason: string) => asserts value = (value, reason) => { if (!value) throw Error(reason); };
export const feasibilitySelectors = ["cuda_f64_nonzero_native_scores_round_trip", "cuda_f64_direct_sgd_changes_policy_parameters"] as const;

export async function feasibilityPlan() {
  const observation = JSON.parse(await readFile(buildObservation, "utf8")), bytes = await readFile(buildReport), report = JSON.parse(bytes.toString());
  requireValue(selection.sourcePreparationSelected && observation.status === "OPERATOR_REPORTED_PASS_HOST_GPU_NATIVE_BUILD_ONLY"
    && observation.remainingHostInvocations === 0 && report.status === "PASS_HOST_GPU_NATIVE_BUILD_ONLY" && report.nativeReceipt.sourceStabilityChecked === true
    && report.nativeReceipt.sourceChanged === false && report.nativeReceipt.sourceManifestSha256 === "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec"
    && report.artifacts.length === 5, "ACCEPTED_REPORTED_NATIVE_BUILD_TWO_REQUIRED");
  return {
    ...base, version: "chess-coach.owned-gpu-feasibility-proposal.v1", status: "DRAFT_SOURCE_ONLY_FRESH_HOST_GPU_JIT_APPROVAL_REQUIRED",
    method: "OWNED_GPU_CONTAINER_PRECOMPILED_F64_FEASIBILITY_PAIR", runId: "host-gpu-feasibility-1", grant: "--approved-host-gpu-feasibility-1",
    workspace: "_work/gpu-owner-recovery/cache/host-gpu-feasibility-1", evidence: "_work/gpu-owner-recovery/runs/host-gpu-feasibility-1",
    retained: { native: "_work/gpu-owner-recovery/cache/host-gpu-native-build-2/native", target: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/native/target-gpu", bun: "_work/gpu-owner-recovery/cache/host-gpu-native-build-1/bun" },
    sourceManifestSha256: report.nativeReceipt.sourceManifestSha256 as string,
    buildReport: { path: buildReport, sha256: digest(bytes) }, artifacts: report.artifacts as ArtifactBinding[],
    selectedUuid: selection.selectedUuid, guard: selection.guard, testLoop: { perTestMs: 120000, totalMs: 270000, cleanupReserveMs: 30000 },
    resources: { cpus: 2, memoryBytes: 8589934592, memoryPlusSwapBytes: 8589934592, cargoJobs: 0, rayonThreads: 2, uidGid: "CURRENT_OPERATOR_NUMERIC_UID_GID" },
    limits: { ...base.limits, overallMs: 600000, normalOperationsMs: 480000, cleanupMs: 90000, receiptReserveMs: 30000,
      dockerCommandMs: 20000, nativeWorkMs: 410000, preflightMs: 120000, driverFinalizationMs: 20000, minimumFreeBytes: 8589934592,
      minimumRunningFreeBytes: 4294967296, workspaceSoftBytes: 4294967296, journalBytes: 1048576, watchdogPollMs: 250,
      telemetryQueries: 150, hostDockerStreamsBytes: 58720256, nativeStreamsBytes: 1275068416, canonicalLogCopiesBytes: 0 },
    maximums: { ...base.maximums, donorCreates: 0, donorStarts: 0, bunCopies: 0, containerRemovals: 1, dockerOperations: 7, cargoCompilations: 0 },
    hostExecutionApproved: false, stagingAndNativeCompilationApproved: false, stagingOrCopyingApproved: false,
    gpuExecutionAuthorized: false, kernelJitCompilationAuthorized: false, publicationAuthorized: false, trainingAuthorized: false,
    automaticRetryAuthorized: false, trainingReady: false,
  };
}
export type FeasibilityPlan = Awaited<ReturnType<typeof feasibilityPlan>>;
export function feasibilityPaths(root: string, p: FeasibilityPlan) {
  return { context: resolve(root, p.context), workspace: resolve(root, p.workspace), evidence: resolve(root, p.evidence),
    native: resolve(root, p.retained.native), target: resolve(root, p.retained.target), bun: resolve(root, p.retained.bun),
    scratch: resolve(root, p.workspace, "scratch"), inner: resolve(root, p.evidence, "inner"), runs: resolve(root, p.evidence, "inner-runs") };
}
export type FeasibilityPaths = ReturnType<typeof feasibilityPaths>;
