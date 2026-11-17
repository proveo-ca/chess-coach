// SPEC: _spec/runtime-protocol.puml, _spec/checkpoint-runtime.puml
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { campaignInvocation, campaignPlan, checkCampaignApproval, checkCampaignBudget, checkCampaignInvocation,
  extendCampaignSource, CAMPAIGN_ADDITIONS, FULL_CAMPAIGN_SCOPE, SELECTED_CAMPAIGN_BUDGET } from "./campaign-plan";
import type { CampaignApproval } from "./campaign-plan";

test("selected 18-day envelope is explicit, inert and separate from occupied qualification roots", () => {
  const plan = campaignPlan(SELECTED_CAMPAIGN_BUDGET);
  expect(plan.budget?.workMs).toBe(18 * 86400000); expect(plan.budget?.validationMs).toBe(43200000);
  expect(plan.budget?.workspaceBytes).toBe(256 * 1024 ** 3); expect(plan.budget?.minimumFreeBytes).toBe(264 * 1024 ** 3);
  expect(plan.trainingExecutionAuthorized).toBe(false); expect(plan.publicationAuthorized).toBe(false);
  expect(plan.campaign).toEqual({ masters: [101, 102, 103, 104, 105], verifiedPerMaster: 1000, attempts: 5000, coordinators: 1, factories: 1, finalizations: 1, closes: 1, primaryMaster: 101 });
  expect(plan.limits!.queryCapacity).toBeGreaterThan(401); expect(plan.root).not.toContain("qualification");
  expect(plan.mounts.filter(m => !m.readonly).every(m => m.source.startsWith(plan.root + "/"))).toBe(true);
  expect(plan.mounts.some(m => m.source.includes("full1"))).toBe(false); expect(plan.ordinaryGpuMains).toBe("UNCHANGED_OFF");
});
test("an unset budget cannot produce invocation deadlines", () => {
  const plan = campaignPlan(null); expect(plan.budget).toBeNull(); expect(plan.limits).toBeNull();
  expect(() => campaignInvocation(plan, 1)).toThrow("INVOCATION_ORIGIN");
});
for (const patch of [{ workMs: 800000, inactivityMs: 800001 }, { cleanupMs: 1 }, { inactivityMs: 300000 }, { workMs: NaN },
  { workspaceBytes: 2 * 1024 ** 3 }, { minimumFreeBytes: 256 * 1024 ** 3 }, { validationMs: 1 }, { workMs: 2147483647 }]) {
  test(`rejects incompatible envelope ${JSON.stringify(patch)}`, () => expect(() => checkCampaignBudget({ ...SELECTED_CAMPAIGN_BUDGET, ...patch })).toThrow());
}
test("one origin fixes work, validation and cleanup deadlines without renewal", () => {
  const plan = campaignPlan(SELECTED_CAMPAIGN_BUDGET), timing = campaignInvocation(plan, 123);
  expect(timing.workDeadlineMs).toBe(123 + 18 * 86400000); expect(timing.validationDeadlineMs).toBe(timing.workDeadlineMs + 43200000);
  expect(timing.cleanupDeadlineMs).toBe(timing.validationDeadlineMs + 600000); checkCampaignInvocation(plan, timing);
  expect(() => checkCampaignInvocation(plan, { ...timing, workDeadlineMs: timing.workDeadlineMs + 1 })).toThrow("INVOCATION_RENEWED");
});
test("no CLI mode, readiness flag, stale approval or GPUv1 grant substitutes for fresh campaign approval", () => {
  const packet = { byteLength: 123, sha256: "a".repeat(64) }, approval: CampaignApproval = { version: "chess-coach.training-execution-approval.v1",
    approvedBy: "Executor", action: "EXECUTE_FULL_CAMPAIGN_ONCE", packetSha256: packet.sha256, nativeScope: FULL_CAMPAIGN_SCOPE, trainingExecutionAuthorized: true };
  expect(() => checkCampaignApproval(null, packet)).toThrow("FRESH_EXECUTION_APPROVAL_REQUIRED"); checkCampaignApproval(approval, packet);
  expect(() => checkCampaignApproval({ ...approval, packetSha256: "b".repeat(64) }, packet)).toThrow();
  expect(() => checkCampaignApproval({ ...approval, nativeScope: "GPUv1" } as unknown as CampaignApproval, packet)).toThrow();
  expect(() => checkCampaignApproval({ ...approval, trainingExecutionAuthorized: false } as unknown as CampaignApproval, packet)).toThrow();
});
test("new closure extends, never mutates, immutable 108-file qualification generation", () => {
  const source = JSON.parse(readFileSync(new URL("./qualification-packet-1/source-3/source-manifest.json", import.meta.url), "utf8"));
  const before = JSON.stringify(source), additions = CAMPAIGN_ADDITIONS.map(path => ({ path, byteLength: 100, sha256: "b".repeat(64) }));
  const result = extendCampaignSource(source.files, additions); expect(result.fileCount).toBe(112); expect(result.byteLength).toBe(641923);
  expect(JSON.stringify(source)).toBe(before); expect(() => extendCampaignSource(source.files, additions.slice(1))).toThrow("CAMPAIGN_SOURCE_ADDITIONS");
  expect(() => extendCampaignSource(source.files, additions.map((r, i) => i === 0 ? { ...r, path: "../outside" } : r))).toThrow();
});
