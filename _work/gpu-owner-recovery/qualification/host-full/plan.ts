// SPEC: _spec/gpu-full-qualification.puml
import { readFile } from "node:fs/promises";
import { digest, feasibilityPaths, feasibilityPlan, requireValue } from "../host-feasibility/plan";
import selection from "./selection.json";

export { digest, requireValue } from "../host-feasibility/plan";
export const feasibilityObservation = "_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/observation.json";
export const feasibilityReport = "_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/reported-receipt.json";
export const fullSelectors = [
  "cuda_f64_nonzero_native_scores_round_trip", "cuda_f64_direct_sgd_changes_policy_parameters",
  "cuda_feature_complete_sweep_for_active_relu_checks_2335_coordinates", "cuda_feature_complete_sweep_for_inactive_relu_checks_2335_coordinates",
  "cuda_f64_redundant_learning_channels_agree_and_reload", "cuda_f64_policy_channel_subprocesses_agree_and_reload",
] as const;

export async function fullPlan() {
  const base = await feasibilityPlan(), observationBytes = await readFile(feasibilityObservation), reportBytes = await readFile(feasibilityReport);
  const observation = JSON.parse(observationBytes.toString()), report = JSON.parse(reportBytes.toString());
  requireValue(selection.sourcePreparationSelected && observation.reportedGpuFeasibilityPairPassed === true && observation.remainingHostInvocations === 0
    && report.status === "PASS_HOST_GPU_FEASIBILITY_ONLY" && report.innerReceipt.status === "PASS_GPU_FEASIBILITY_TESTS_ONLY"
    && report.innerReceipt.sourceManifestSha256 === base.sourceManifestSha256, "ACCEPTED_REPORTED_F64_PAIR_AND_CONSUMED_HOST_GRANT_REQUIRED");
  return { ...base, version: "chess-coach.owned-gpu-full-proposal.v1", status: "DRAFT_SOURCE_ONLY_FRESH_HOST_GPU_JIT_APPROVAL_REQUIRED",
    method: "OWNED_GPU_CONTAINER_PRECOMPILED_F64_FULL_SIX", runId: "host-gpu-full-1", grant: "--approved-host-gpu-full-1",
    workspace: "_work/gpu-owner-recovery/cache/host-gpu-full-1", evidence: "_work/gpu-owner-recovery/runs/host-gpu-full-1",
    reportedFeasibility: { observation: { path: feasibilityObservation, sha256: digest(observationBytes) }, report: { path: feasibilityReport, sha256: digest(reportBytes) } },
    testLoop: { perTestMs: 120000, totalMs: 750000, cleanupReserveMs: 30000 },
    limits: { ...base.limits, overallMs: 1080000, normalOperationsMs: 960000, nativeWorkMs: 890000, telemetryQueries: 400, nativeStreamsBytes: 3405774848 },
    fullNumericalAndC12Qualified: false, coldJitQualified: false };
}
export type FullPlan = Awaited<ReturnType<typeof fullPlan>>;
export function fullPaths(root: string, p: FullPlan) { return feasibilityPaths(root, p); }
export type FullPaths = ReturnType<typeof fullPaths>;
export function fullSteps(p: FullPlan) {
  const harness = (name: string) => {
    const bindings = p.artifacts.filter(row => row.executable.startsWith("/build/native/target-gpu/x86_64-unknown-linux-gnu/release/deps/" + name + "-"));
    requireValue(bindings.length === 1, "EXACT_FULL_CAMPAIGN_HARNESS_REQUIRED:" + name);
    return bindings[0]!.executable;
  };
  const learning = harness("finite_difference"), policy = harness("gpu");
  return fullSelectors.map(id => ({ id, selector: id, count: 1, executable: id.startsWith("cuda_feature_") ? learning : policy }));
}
