// SPEC: _spec/gpu-feasibility.puml
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { gpuSelectors } from "../../../../tooling/runtime/qualification";
import { feasibilityPlan, feasibilityPaths, feasibilitySelectors, digest } from "./plan";

test("selected source preparation carries no execution, cache-write or publication approval", async () => {
  const p = await feasibilityPlan();
  for (const key of ["hostExecutionApproved", "stagingAndNativeCompilationApproved", "stagingOrCopyingApproved", "gpuExecutionAuthorized", "kernelJitCompilationAuthorized", "publicationAuthorized", "trainingAuthorized", "automaticRetryAuthorized", "trainingReady"] as const) expect(p[key]).toBe(false);
  expect(feasibilitySelectors as readonly string[]).toEqual(gpuSelectors.slice(0, 2));
  expect(p.maximums.cargoCompilations).toBe(0); expect(p.resources.cargoJobs).toBe(0);
  expect(p.limits.normalOperationsMs + p.limits.cleanupMs + p.limits.receiptReserveMs).toBe(p.limits.overallMs);
  expect(p.limits.preflightMs + p.testLoop.totalMs + p.limits.driverFinalizationMs).toBe(p.limits.nativeWorkMs);
  expect(p.testLoop).toEqual({ perTestMs: 120000, totalMs: 270000, cleanupReserveMs: 30000 });
  expect(p.guard).toEqual({ startupMinFreeBytes: 3221225472, runningStopBelowFreeBytes: 2147483648, sampleIntervalMs: 2000, queryTimeoutMs: 1000, maxSampleAgeMs: 4000 });
  expect(p.limits.nativeStreamsBytes).toBe((p.limits.telemetryQueries + 2) * 2 * 4194304);
  expect(p.artifacts.reduce((n, r) => n + r.bytes, 0)).toBe(769483104);
  expect(digest(await readFile(p.buildReport.path))).toBe(p.buildReport.sha256);
});

test("the draft maps only retained RO inputs and fresh writable output roots", async () => {
  const p = await feasibilityPlan(), paths = feasibilityPaths("/source-only-mock", p);
  expect(paths.native).toEndWith("host-gpu-native-build-2/native"); expect(paths.target).toEndWith("host-gpu-native-build-1/native/target-gpu");
  expect(paths.scratch).toEndWith("host-gpu-feasibility-1/scratch"); expect(paths.runs).toEndWith("host-gpu-feasibility-1/inner-runs");
  expect(p.sourceManifestSha256).toBe("7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec");
  expect(p.artifacts[1]!.sha256).toBe("9091cb81c4caa234b356e0edb357843a260130d9d7a6d66ee2ee4d563c714f9f");
});
