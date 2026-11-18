// SPEC: _spec/gpu-feasibility.puml
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { validateReportedFeasibility } from "./contract";
import type { FeasibilityPlan } from "../../qualification/host-feasibility/plan";

const root = new URL("./", import.meta.url);
const report = JSON.parse(await readFile(new URL("reported-receipt.json", root), "utf8"));
const request = JSON.parse(await readFile(new URL("../host-gpu-feasibility-source-4/host-command-approval.json", root), "utf8"));
const plan: FeasibilityPlan = JSON.parse(await readFile(new URL("../host-gpu-feasibility-source-4/plan.json", root), "utf8"));
const summary = await readFile(new URL("operator-summary.txt", root), "utf8");

test("accepts the complete reported F64 pair with zero marker without reading HOST artifacts or journal", () => {
  expect(() => validateReportedFeasibility(report, request, plan, summary)).not.toThrow();
});

for (const [name, mutate] of [
  ["a failed test", (r: any) => { r.innerReceipt.results[0].exitCode = 101; }],
  ["a missing test", (r: any) => { r.innerReceipt.results.pop(); }],
  ["empty test acceptance", (r: any) => { r.innerReceipt.qualificationResults[0].stdoutSummaries[0] = "test result: ok. 0 passed; 0 failed; 0 ignored; 0 measured"; }],
  ["ignored test acceptance", (r: any) => { r.innerReceipt.qualificationResults[1].stdoutSummaries[0] = "test result: ok. 1 passed; 0 failed; 1 ignored; 0 measured"; }],
  ["duplicate summaries", (r: any) => { r.innerReceipt.qualificationResults[0].stdoutSummaries.push(r.innerReceipt.qualificationResults[0].stdoutSummaries[0]); }],
  ["wrong source generation", (r: any) => { r.innerReceipt.sourceManifestSha256 = "0".repeat(64); }],
  ["unchecked source", (r: any) => { r.innerReceipt.sourceStabilityChecked = false; }],
  ["changed source", (r: any) => { r.innerReceipt.sourceChanged = true; }],
  ["wrong artifact hash", (r: any) => { r.innerReceipt.artifacts[1].sha256 = "0".repeat(64); }],
  ["wrong test argv", (r: any) => { r.innerReceipt.results[1].argv.pop(); }],
  ["foreign GPU UUID", (r: any) => { r.innerReceipt.telemetry.samples[1].uuid = "GPU-foreign"; }],
  ["low headroom", (r: any) => { r.innerReceipt.telemetry.samples[1].freeBytes = 2047 * 1048576; }],
  ["stale replacement", (r: any) => { r.innerReceipt.telemetry.samples[1].observedAtMs = r.innerReceipt.telemetry.samples[0].queryStartedAtMs + 4000; }],
  ["overlapping query", (r: any) => { r.innerReceipt.telemetry.samples[1].queryStartedAtMs = r.innerReceipt.telemetry.samples[0].queryStartedAtMs + 500; }],
  ["failed telemetry", (r: any) => { r.innerReceipt.telemetry.queries[1].exitCode = 6; }],
  ["unchecked guard", (r: any) => { r.guardComplete = false; }],
  ["journal write failure", (r: any) => { r.innerReceipt.telemetry.events.writeFailed = true; }],
  ["foreign cleanup target", (r: any) => { r.results[4].argv[3] = "a".repeat(64); }],
  ["failed cleanup", (r: any) => { r.cleanupFailures.push("MOCK_CLEANUP_FAILED"); }],
  ["running container", (r: any) => { r.state.Running = true; }],
  ["renewed HOST allowance", (r: any) => { r.remainingHostInvocations = 1; }],
  ["invented readiness", (r: any) => { r.trainingReady = true; }],
  ["invented full assurance", (r: any) => { r.innerReceipt.fullAssuranceQualified = true; }],
  ["capture mismatch", (r: any) => { r.captures[0].streams[0].bytes++; }],
] as const) test("reported PASS rejects " + name, () => {
  const changed = structuredClone(report); mutate(changed);
  expect(() => validateReportedFeasibility(changed, request, plan, summary)).toThrow();
});

test("neither a missing nor nonzero nor duplicate HOST marker accepts a PASS receipt", () => {
  for (const text of [summary.split("\n")[0]!, summary.replace("HOST_GPU_FEASIBILITY_EXIT=0", "HOST_GPU_FEASIBILITY_EXIT=1"), summary + "HOST_GPU_FEASIBILITY_EXIT=0\n"]) {
    expect(() => validateReportedFeasibility(report, request, plan, text)).toThrow();
  }
});
