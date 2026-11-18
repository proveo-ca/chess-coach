// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { isDeepStrictEqual } from "node:util";
import { qualificationPlan } from "./qualification-operator";
import { storageAdmissionBound } from "../../packages/runtime/src/storage-bounds";
import type { ByteRef } from "../../packages/contracts/src/training-state";

export type CampaignBudget = Readonly<{ workMs: number; validationMs: number; cleanupMs: number; inactivityMs: number;
  workspaceBytes: number; minimumFreeBytes: number }>;
const GIB = 1024 ** 3, DAY = 86400000;
export const SELECTED_CAMPAIGN_BUDGET: CampaignBudget = Object.freeze({ workMs: 18 * DAY, validationMs: DAY / 2,
  cleanupMs: 600000, inactivityMs: 600000, workspaceBytes: 256 * GIB, minimumFreeBytes: 264 * GIB });
export const CAMPAIGN_ENTRY = "artifacts/training-functional/campaign-operator.ts";
export const CAMPAIGN_ADDITIONS = Object.freeze(["packages/runtime/src/training-campaign.ts",
  "artifacts/training-functional/campaign-plan.ts", CAMPAIGN_ENTRY, "artifacts/training-functional/campaign-evidence.ts"]);
export const FULL_CAMPAIGN_SCOPE = "FULL_FIVE_MASTER_TRAINING_NOT_GPUV1_EXTENSION";
export const CAMPAIGN_PACKET = "artifacts/training-functional/full-training-packet-1";
export const CAMPAIGN_PACKET_V2 = "artifacts/training-functional/full-training-packet-2";
export const CAMPAIGN_STORAGE_ROOT = "/var/lib/chess-coach/training-volume-1";
export const READINESS_COMMIT = "dad29306a83268aeed720b7e9b8311a6d9d941e1";
export function campaignCheck(value: unknown, code: string): asserts value { if (!value) throw new Error(`Campaign packet: ${code}`); }
export function checkCampaignBudget(budget: CampaignBudget): CampaignBudget {
  campaignCheck(budget && Object.keys(budget).sort().join() === ["workMs", "validationMs", "cleanupMs", "inactivityMs", "workspaceBytes", "minimumFreeBytes"].sort().join(), "BUDGET_SCHEMA");
  campaignCheck(Object.values(budget).every(v => Number.isSafeInteger(v) && v > 0), "BUDGET_INTEGER");
  campaignCheck(budget.workMs + budget.validationMs + budget.cleanupMs <= 2147483647 && budget.cleanupMs >= 30000 &&
    budget.inactivityMs > 300000 && budget.inactivityMs <= budget.workMs && budget.validationMs >= 60000, "BUDGET_TIMING");
  campaignCheck(budget.workspaceBytes >= storageAdmissionBound().requiredUsableBytes && budget.minimumFreeBytes >= budget.workspaceBytes + 8 * GIB, "BUDGET_STORAGE");
  return Object.freeze({ ...budget });
}
export function campaignPlan(budget: CampaignBudget | null, generation: 1 | 2 = 1) {
  campaignCheck(generation === 1 || generation === 2, "CAMPAIGN_GENERATION");
  const old = qualificationPlan(), base = generation === 1 ? `${old.host}/_work/gpu-owner-recovery/runs` : CAMPAIGN_STORAGE_ROOT,
    root = `${base}/training-campaign-${generation}`, inputs = `${base}/training-campaign-inputs-${generation}`;
  const selected = budget === null ? null : checkCampaignBudget(budget);
  const mounts = old.mounts.map(m => ({ ...m, source: m.source.startsWith(old.inputs) ? inputs + m.source.slice(old.inputs.length) :
    m.source.startsWith(old.root + "/") ? root + m.source.slice(old.root.length) : m.source }));
  const plan = { version: "chess-coach.training-campaign-plan.v1", scope: "SOURCE_ONLY_FULL_TRAINING_PACKET", readinessCommit: READINESS_COMMIT,
    host: old.host, cachedBun: old.cachedBun, root, inputs, source: `${inputs}/app`, reference: `${inputs}/reference`, documents: `${inputs}/qualification-inputs`,
    delivery: `${base}/training-campaign-delivery-${generation}`, entrypoint: CAMPAIGN_ENTRY, image: old.image, gpu: old.gpu, mounts,
    roots: "PROPOSED_NOT_HOST_CHECKED_MUST_BE_ABSENT_EXCLUSIVE_CREATE_NO_ADOPTION_OR_RETRY",
    retainedPreparedInputs: old.inputs, preparation: "FUTURE_APPROVAL_COPY_RETAINED_INPUTS_READONLY_EXTEND_SOURCE_AND_FOUR_DOCUMENTS_NO_BUILDS_OR_ACQUISITION",
    requiredSourceAdditions: [...CAMPAIGN_ADDITIONS], replacedDocumentRoles: ["source", "tests", "runtimeConfiguration", "recipe"],
    campaign: { masters: [101, 102, 103, 104, 105], verifiedPerMaster: 1000, attempts: 5000, coordinators: 1, factories: 1, finalizations: 1, closes: 1, primaryMaster: 101 },
    nativeScope: FULL_CAMPAIGN_SCOPE, gpuV1: "UNCHANGED_MASTER101_ORDINAL0", ordinaryGpuMains: "UNCHANGED_OFF",
    numeric: { precision: "F64", finiteDifferenceCoordinates: 4670, eps: 1e-6, atol: 1e-8, rtol: 1e-5, c12: "DISTINCT_ASSERTIONS_UNCHANGED" },
    resources: { cpus: 2, memoryBytes: 8 * GIB, swapBytes: 0, gpuAdmissionMiB: 3072, gpuRunningMiB: 2048 },
    budget: selected, limits: selected === null ? null : { queryMs: 1000, intervalMs: 2000, maxAgeMs: 4000,
      queryCapacity: Math.ceil((selected.workMs + selected.validationMs) / 2000) + 2, workspaceCheckMs: 60000,
      reportBytes: 1048576, progressBytes: 4096, telemetryBytes: GIB, dockerCommands: 7 },
    storageAdmission: storageAdmissionBound(), rawNativeTrace: "NOT_RETAINED_NO_QUALIFICATION_TRACE_ARRAY_REUSE",
    progress: "ONLY_VERIFIED_COMPLETIONS_OR_VALIDATION_PROGRESS_RESET_INACTIVITY",
    trainingExecutionAuthorized: false, publicationAuthorized: false, technicalTrainingReady: true,
    deferredHardening: "AFTER_ALL_PLANNED_TRAINING_AND_VALIDATED_RESULTS" } as const;
  return generation === 1 ? plan : { ...plan, version: "chess-coach.training-campaign-plan.v2", entryPolicy: "BTRFS_DYNAMIC_ACKNOWLEDGED" } as const;
}
export type CampaignPlan = ReturnType<typeof campaignPlan>;
export type CampaignInvocation = { originMs: number; workDeadlineMs: number; validationDeadlineMs: number; cleanupDeadlineMs: number };
export function campaignInvocation(plan: CampaignPlan, originMs: number): CampaignInvocation {
  campaignCheck(plan.budget && Number.isFinite(originMs) && originMs >= 0 && originMs + plan.budget.workMs + plan.budget.validationMs + plan.budget.cleanupMs < Number.MAX_SAFE_INTEGER, "INVOCATION_ORIGIN");
  return { originMs, workDeadlineMs: originMs + plan.budget.workMs, validationDeadlineMs: originMs + plan.budget.workMs + plan.budget.validationMs,
    cleanupDeadlineMs: originMs + plan.budget.workMs + plan.budget.validationMs + plan.budget.cleanupMs };
}
export function checkCampaignInvocation(plan: CampaignPlan, invocation: CampaignInvocation): void {
  campaignCheck(invocation && isDeepStrictEqual(invocation, campaignInvocation(plan, invocation.originMs)), "INVOCATION_RENEWED");
}
export type CampaignApproval = { version: "chess-coach.training-execution-approval.v1"; approvedBy: "Executor";
  action: "EXECUTE_FULL_CAMPAIGN_ONCE"; packetSha256: string; nativeScope: typeof FULL_CAMPAIGN_SCOPE; trainingExecutionAuthorized: true };
export function checkCampaignApproval(approval: CampaignApproval | null, packet: ByteRef): void {
  campaignCheck(packet && Number.isSafeInteger(packet.byteLength) && packet.byteLength > 0 && /^[a-f0-9]{64}$/.test(packet.sha256), "PACKET_REF");
  campaignCheck(approval && approval.version === "chess-coach.training-execution-approval.v1" && approval.approvedBy === "Executor" &&
    approval.action === "EXECUTE_FULL_CAMPAIGN_ONCE" && approval.trainingExecutionAuthorized === true && approval.packetSha256 === packet.sha256 &&
    approval.nativeScope === FULL_CAMPAIGN_SCOPE, "FRESH_EXECUTION_APPROVAL_REQUIRED");
}
export type SourceRow = ByteRef & { path: string };
export function extendCampaignSource(source: readonly SourceRow[], additions: readonly SourceRow[]) {
  campaignCheck(source.length === 108 && source.reduce((n, r) => n + r.byteLength, 0) === 641523, "QUALIFICATION_SOURCE_GENERATION");
  campaignCheck(additions.length === CAMPAIGN_ADDITIONS.length && CAMPAIGN_ADDITIONS.every(p => additions.some(r => r.path === p)), "CAMPAIGN_SOURCE_ADDITIONS");
  const files = [...source, ...additions].map(r => ({ ...r })).sort((a, b) => a.path.localeCompare(b.path));
  campaignCheck(new Set(files.map(r => r.path)).size === files.length && files.every(r => /^[a-zA-Z0-9_./-]+$/.test(r.path) &&
    !r.path.startsWith("/") && r.path.split("/").every(p => p && p !== "." && p !== "..") && Number.isSafeInteger(r.byteLength) &&
    r.byteLength > 0 && r.byteLength <= 16 * 1048576 && /^[a-f0-9]{64}$/.test(r.sha256)), "SOURCE_ROWS");
  return { version: "chess-coach.training-campaign-source.v1", scope: "NEW_SOURCE_CLOSURE_QUALIFICATION_GENERATION_UNMODIFIED", fileCount: files.length,
    byteLength: files.reduce((n, r) => n + r.byteLength, 0), files };
}
