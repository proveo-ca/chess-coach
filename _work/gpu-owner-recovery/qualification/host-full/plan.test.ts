// SPEC: _spec/gpu-full-qualification.puml
import { expect, test } from "bun:test";
import { gpuSelectors, qualificationPlan, validateLimits } from "../../../../tooling/runtime/qualification";
import { fullPaths, fullPlan, fullSelectors, fullSteps } from "./plan";
import selection from "./selection.json";

test("selected HOST bounds authorize source preparation only", async () => {
  expect(selection.sourcePreparationSelected).toBe(true);
  for (const key of ["hostExecutionApproved", "stagingOrCopyingApproved", "gpuExecutionApproved", "kernelJitCompilationApproved", "publicationApproved", "trainingApproved", "automaticRetryAuthorized", "trainingReady"] as const) expect(selection[key]).toBe(false);
  const p = await fullPlan();
  expect(p.runId).toBe("host-gpu-full-1"); expect(p.grant).toBe("--approved-host-gpu-full-1");
  expect(p.workspace).not.toContain("feasibility-1"); expect(p.evidence).not.toContain("feasibility-1");
  for (const key of ["hostExecutionApproved", "stagingAndNativeCompilationApproved", "stagingOrCopyingApproved", "gpuExecutionAuthorized", "kernelJitCompilationAuthorized", "publicationAuthorized", "trainingAuthorized", "automaticRetryAuthorized", "trainingReady"] as const) expect(p[key]).toBe(false);
});

test("full-six plan preserves qualification selectors, acceptance and per-step harnesses", async () => {
  const p = await fullPlan(), steps = fullSteps(p);
  expect(fullSelectors).toEqual(gpuSelectors);
  const artifacts = new Map([["learning:test:finite_difference", { executable: steps[2]!.executable, count: 1 }], ["policy-io:test:gpu", { executable: steps[0]!.executable, count: 1 }]]);
  expect(qualificationPlan("gpu", "full", artifacts)).toEqual(steps);
  expect(steps.map(row => row.executable)).toEqual([p.artifacts[1]!.executable, p.artifacts[1]!.executable, p.artifacts[0]!.executable, p.artifacts[0]!.executable, p.artifacts[1]!.executable, p.artifacts[1]!.executable]);
  expect(() => fullSteps({ ...p, artifacts: p.artifacts.filter(row => !row.executable.includes("/deps/finite_difference-")) })).toThrow("HARNESS");
});

test("18-minute bounds preserve reserves, ordinary cooperation and bounded-failure disk sizing", async () => {
  const p = await fullPlan(); validateLimits(p.testLoop, 6);
  expect(p.testLoop).toEqual({ perTestMs: 120000, totalMs: 750000, cleanupReserveMs: 30000 });
  expect(p.limits.nativeWorkMs).toBe(p.limits.preflightMs + p.testLoop.totalMs + p.limits.driverFinalizationMs);
  expect(p.limits.overallMs).toBe(p.limits.normalOperationsMs + p.limits.cleanupMs + p.limits.receiptReserveMs);
  expect(p.limits.overallMs).toBe(1080000); expect(p.limits.telemetryQueries).toBe(400);
  expect(p.limits.nativeStreamsBytes).toBe((400 + 6) * 2 * 4194304);
  expect(p.limits.workspaceSoftBytes - p.limits.nativeStreamsBytes - p.limits.hostDockerStreamsBytes).toBe(792 * 1048576);
  expect(p.resources.memoryBytes).toBe(8589934592); expect(p.resources.memoryPlusSwapBytes).toBe(p.resources.memoryBytes); expect(p.resources.cpus).toBe(2);
  const paths = fullPaths("/operator/repo", p);
  expect(paths.scratch).toBe("/operator/repo/" + p.workspace + "/scratch"); expect(paths.native).toContain("host-gpu-native-build-2/native");
});
