// SPEC: _spec/gpu-host-build-reuse.puml
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { validateReportedBuildTwo } from "./contract";
import type { ReusePlan } from "../../qualification/host-build-reuse/plan";

const root = new URL("./", import.meta.url);
const report = JSON.parse(await readFile(new URL("reported-receipt.json", root), "utf8"));
const request = JSON.parse(await readFile(new URL("../host-gpu-build-handoff-2/request.json", root), "utf8"));
const plan: ReusePlan = JSON.parse(await readFile(new URL("../host-gpu-cache-reuse-source-3/plan.json", root), "utf8"));
const summary = await readFile(new URL("operator-summary.txt", root), "utf8");

test("the complete reported native-build pass is accepted without reading host artifacts", () => {
  expect(() => validateReportedBuildTwo(report, request, plan, summary)).not.toThrow();
});

for (const [name, mutate] of [
  ["failed compilation", (r: any) => { r.nativeReceipt.results[4].exitCode = 101; }],
  ["missing compilation", (r: any) => { r.nativeReceipt.compilationAttempts = 1; }],
  ["unchecked source", (r: any) => { r.nativeReceipt.sourceStabilityChecked = false; }],
  ["changed source", (r: any) => { r.nativeReceipt.sourceChanged = true; }],
  ["wrong generation", (r: any) => { r.nativeReceipt.sourceManifestSha256 = request.previousSourceManifestSha256; }],
  ["foreign start target", (r: any) => { r.results[1].argv[3] = "a".repeat(64); }],
  ["unapproved cache scope", (r: any) => { r.mutableCachePaths.push(r.cachePaths.bun); }],
  ["cleanup error", (r: any) => { r.cleanupFailures.push("MOCK_CLEANUP_FAILURE"); }],
  ["running worker", (r: any) => { r.state.Running = true; }],
  ["missing artifact", (r: any) => { r.artifacts.pop(); }],
  ["wrong artifact target", (r: any) => { r.artifacts[1].path = r.artifacts[1].path.replace("target-gpu", "target-cpu"); }],
  ["malformed artifact digest", (r: any) => { r.artifacts[0].sha256 = "short"; }],
  ["invented GPU evidence", (r: any) => { r.gpuExecuted = true; }],
  ["invented readiness", (r: any) => { r.trainingReady = true; }],
  ["renewed allowance", (r: any) => { r.remainingHostInvocations = 1; }],
] as const) test("reported PASS rejects " + name, () => {
  const changed = structuredClone(report); mutate(changed);
  expect(() => validateReportedBuildTwo(changed, request, plan, summary)).toThrow();
});

test("a pass receipt cannot replace a missing or nonzero final host marker", () => {
  for (const text of [summary.replace("HOST_NATIVE_BUILD_EXIT=0", "HOST_NATIVE_BUILD_EXIT=1"), summary.split("\n")[0]!, summary + "HOST_NATIVE_BUILD_EXIT=0\n"]) expect(() => validateReportedBuildTwo(report, request, plan, text)).toThrow();
});
