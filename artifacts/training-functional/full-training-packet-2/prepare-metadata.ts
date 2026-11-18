// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { campaignPlan, SELECTED_CAMPAIGN_BUDGET } from "../campaign-plan";
import { assessCampaignStorage } from "../campaign-operator";
import type { CampaignCapacity } from "../campaign-operator";
import { checkPreservedPacket1, ensure, PACKET1, PACKET2, pin, readJson, writeJson } from "./preserve";

export const VOLUME_EVIDENCE = "artifacts/training-functional/campaign-volume-preflight-1/returned-2";
export const PROCEED_DECISION = `${VOLUME_EVIDENCE}/proceed-decision-1.json`;
export function packetMetadata() {
  const plan = campaignPlan(SELECTED_CAMPAIGN_BUDGET, 2);
  ensure(plan.version === "chess-coach.training-campaign-plan.v2", "V2_PLAN");
  const observedPath = `${VOLUME_EVIDENCE}/user-report.json`;
  const observed = readJson<{ report: { hostPath: string; capacity: { raw: Record<keyof CampaignCapacity, string> } } }>(observedPath);
  ensure(observed.report.hostPath === plan.root.slice(0, plan.root.lastIndexOf("/")), "SELECTED_HOST_VOLUME");
  const raw = observed.report.capacity.raw, capacity = {} as CampaignCapacity;
  for (const key of ["type", "bsize", "bavail", "files", "ffree"] as const) {
    ensure(typeof raw[key] === "string" && /^[0-9]{1,20}$/.test(raw[key]), "RETAINED_CAPACITY_COUNTER"); capacity[key] = BigInt(raw[key]);
  }
  const assessment = assessCampaignStorage(plan, capacity);
  ensure(assessment.admitted && assessment.policyAcceptedUnknownEntries && !assessment.entryCapacityVerified && assessment.freeEntries === null, "ACKNOWLEDGED_RETAINED_BTRFS");
  const recipe = { status: "SOURCE_ONLY_V2_PACKET_NOT_HOST_PREPARED", previousPacket: PACKET1, preservation: pin(`${PACKET2}/preservation.json`),
    decision: pin(PROCEED_DECISION), volumeObservation: pin(`${VOLUME_EVIDENCE}/observation.json`),
    hostBytesAssumedAvailableForSourcePlanningOnly: true, runtimeByteChecksRetained: true, plan };
  const runtime = { version: "chess-coach.campaign-runtime-configuration.v2", budget: plan.budget, resources: plan.resources, limits: plan.limits,
    storageAdmission: plan.storageAdmission, entryPolicy: plan.entryPolicy, unknownEntryAcceptanceProvesCapacity: false,
    clock: "ORIGINAL_SYSTEM_MONOTONIC_ORIGIN_BEFORE_PREFLIGHT", progress: plan.progress, root: plan.root, mounts: plan.mounts,
    hostAdmission: "CURRENT_STATFS_ON_SELECTED_HOST_PARENT_BEFORE_ROOT_CREATE_GPU_OR_DOCKER",
    workerAdmission: "CURRENT_STATFS_ON_STATE_BEFORE_CORPUS_FACTORY_OR_COORDINATOR",
    workerMode: "worker-v2", operatorMode: "operator-v2", byteAdmissionRequiredAtBothLocations: true,
    currentVolumeEvidence: pin(`${VOLUME_EVIDENCE}/observation.json`), decision: pin(PROCEED_DECISION),
    retainedHostConfigurationRole: "HISTORICAL_QUALIFICATION_BINDING_NOT_CURRENT_VOLUME_OR_ACCESS_ATTESTATION",
    rootsHostChecked: false, directoryUsabilityVerified: false, selinuxCompatibilityVerified: false, trainingExecutionAuthorized: false };
  const storage = { status: "SOURCE_ONLY_RETAINED_REPORT_POLICY_ASSESSMENT_NOT_LIVE_HOST_ADMISSION", observedReport: pin(observedPath),
    validatedObservation: pin(`${VOLUME_EVIDENCE}/observation.json`), decision: pin(PROCEED_DECISION), assessment,
    hostBytesReserved: false, entryAllocationGuaranteed: false, directoryUsabilityVerified: false, selinuxCompatibilityVerified: false,
    retainedHostPayloadsAfterCleanupReverified: false, hostPreparationExecuted: false, trainingExecuted: false };
  return { recipe, runtime, storage };
}
export function preparePacketMetadata() {
  checkPreservedPacket1(); const values = packetMetadata();
  for (const [name, value] of [["plan.json", values.recipe], ["runtime-configuration.json", values.runtime], ["storage-assessment.json", values.storage]] as const) writeJson(`${PACKET2}/${name}`, value);
  return { status: "PASS_SOURCE_ONLY_V2_METADATA_NOT_HOST_PREPARATION", plan: pin(`${PACKET2}/plan.json`),
    runtime: pin(`${PACKET2}/runtime-configuration.json`), storage: pin(`${PACKET2}/storage-assessment.json`), hostPreparationExecuted: false, trainingExecuted: false };
}
if (import.meta.main) {
  try { ensure(Bun.argv.length === 2, "METADATA_ARGUMENTS"); console.log("Executor: " + JSON.stringify(preparePacketMetadata())); }
  catch (error) { console.error("Executor: " + String(error)); process.exitCode = 1; }
}
