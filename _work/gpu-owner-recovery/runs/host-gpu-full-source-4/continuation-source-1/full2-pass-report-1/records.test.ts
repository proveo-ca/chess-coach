// SPEC: _spec/gpu-full-qualification.puml
import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import input from "./reported-input.json";
import { hash, normalizeReportedReceipt, validateReportedFullPass } from "./records";
import type { FullPlan } from "../../../../qualification/host-full/plan";

const plan: FullPlan = JSON.parse(await readFile(new URL("../../plan.json", import.meta.url), "utf8"));
const report = normalizeReportedReceipt();
test("complete normalized full-six report passes existing GPU contracts without readiness promotion", () => {
  const result = validateReportedFullPass(report, plan, 0);
  expect(result.reportedGpuTests).toBe(6); expect(result.finiteDifferenceCoordinates).toBe(4670);
  expect(result.reportedTelemetrySamples).toBe(113); expect(result.reportedCompleteDockerArgv).toBe(5);
  expect(result.reportedStreamMetadataReferences).toBe(258); expect(result.reportedUniqueStreamPaths).toBe(248);
  expect(result.reportedArtifactBytes).toBe(769483104);
  expect(result.minimumReportedFreeBytes).toBe(7910457344);
  expect(result.minimumReportedQueryStartGapMs).toBeGreaterThanOrEqual(2000); expect(result.maximumReportedQueryLatencyMs).toBeLessThan(1000);
  expect(report.trainingReady).toBe(false); expect(report.innerReceipt.trainingExecuted).toBe(false);
});

test("missing or nonzero HOST marker cannot establish outer PASS", () => {
  for (const code of [1, -1, NaN]) expect(() => validateReportedFullPass(report, plan, code)).toThrow();
});

const reject = (change: (value: typeof report) => void) => {
  const value = structuredClone(report); change(value); expect(() => validateReportedFullPass(value, plan, 0)).toThrow();
};

test("every exact selector must have an invoked, passing and accepted unignored result", () => {
  reject(value => { value.innerReceipt.results.pop(); });
  reject(value => { value.innerReceipt.results[0]!.commandInvoked = false; });
  reject(value => { value.innerReceipt.results[0]!.exitCode = 1; });
  reject(value => { value.innerReceipt.qualificationResults[0]!.accepted = false; });
  reject(value => { value.innerReceipt.qualificationResults[0]!.stdoutSummaries = ["test result: ok. 0 passed; 0 failed; 1 ignored;"]; });
  reject(value => { value.innerReceipt.results[2]!.argv[1] = "filtered_partial_sweep"; });
  reject(value => { value.innerReceipt.results[0]!.streams[0]!.path = "/unrelated/command.stdout"; });
  reject(value => { value.innerReceipt.results[0]!.streams[0]!.sha256 = "0".repeat(64); });
});

test("source drift, artifact drift and nonzero remaining allowance reject PASS", () => {
  reject(value => { value.innerReceipt.sourceChanged = true; });
  reject(value => { value.innerReceipt.sourceStabilityChecked = false; });
  reject(value => { value.innerReceipt.sourceManifestSha256 = "0".repeat(64); });
  reject(value => { value.innerReceipt.artifacts[0]!.sha256 = "0".repeat(64); });
  reject(value => { value.remainingHostInvocations = 1; });
  reject(value => { value.innerReceipt.remainingCampaignInvocations = 1; });
});

test("reported telemetry remains subject to the frozen guard and metadata checks", () => {
  reject(value => { value.innerReceipt.telemetry.samples.pop(); });
  reject(value => { value.innerReceipt.telemetry.samples[1]!.queryStartedAtMs = value.innerReceipt.telemetry.samples[0]!.queryStartedAtMs + 1999; });
  reject(value => { value.innerReceipt.telemetry.samples[0]!.freeBytes = 1; });
  reject(value => { value.innerReceipt.telemetry.samples[0]!.observedAtMs += 1001; });
  reject(value => { value.innerReceipt.telemetry.queries[0]!.exitCode = 1; });
  reject(value => { value.innerReceipt.telemetry.queries[0]!.streams[0]!.sha256 = "0".repeat(64); });
  reject(value => { value.innerReceipt.telemetry.queries[0]!.streams[0]!.path = "/unrelated/command.stdout"; });
  reject(value => { value.innerReceipt.telemetry.events.writeFailed = true; });
  reject(value => { value.guardComplete = false; });
});

test("cleanup, complete Docker argv and excluded qualification flags retain their meanings", () => {
  reject(value => { value.state.Running = true; });
  reject(value => { value.state.Status = "created"; });
  reject(value => { value.cleanupFailures.push("failed"); });
  reject(value => { value.results[0]!.argv.push("--privileged"); });
  reject(value => { value.captures.pop(); });
  reject(value => { value.trainingReady = true; });
  reject(value => { value.canonicalBothQualified = true; });
  reject(value => { value.integratedR4Qualified = true; });
  reject(value => { value.innerReceipt.trainingExecuted = true; });
});

test("persisted observation consumes only the fresh grant and accepts operator-report scope", async () => {
  const observation = JSON.parse(await readFile(new URL("./observation.json", import.meta.url), "utf8"));
  expect(observation.provenance).toBe(input.provenance); expect(observation.reportedFullSixPassed).toBe(true);
  expect(observation.remainingHostInvocations).toBe(0); expect(observation.remainingReplacementTextDeliveries).toBe(0);
  expect(observation.originalHostFilesReceived).toBe(false); expect(observation.originalCaptureOrJournalBytesRehashed).toBe(false);
  expect(observation.newHostOrGpuExecutionAuthorized).toBe(false); expect(observation.experimentTrainingAuthorized).toBe(false); expect(observation.trainingReady).toBe(false);
  expect(hash(await readFile(observation.issuedApproval.path))).toBe(observation.issuedApproval.sha256);
  expect(JSON.parse(await readFile(new URL("./reported-receipt.json", import.meta.url), "utf8"))).toEqual(report);
});
