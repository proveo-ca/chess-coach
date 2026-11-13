// SPEC: _spec/gpu-qualification.puml
import { expect, test } from "bun:test";
import { readFile, writeFile } from "node:fs/promises";
import input from "./reported-input.json";
import planSnapshot from "../../host-cpu-regression-source-2/plan.json";
import inventorySnapshot from "../../host-gpu-policy-record-correction-source-2/native-source-manifest.json";
import { acceptCpuWorker } from "../../../qualification/cpu-host";
import { deliveryRoot, hash, normalizeReportedReceipt, receiveReportedPass, reportRoot, snapshotPaths, validateReportedCpuPass, type Report } from "./records";
import { verificationCommands, verificationDirectory } from "./verify";

const report = normalizeReportedReceipt();
const admit = (value = report, code = 0) => validateReportedCpuPass(value, planSnapshot, code);
const reject = (change: (value: Report) => void) => {
  const value = structuredClone(report); change(value); expect(() => admit(value)).toThrow();
};

test("complete CPU39 operator report passes the unchanged worker predicate at report scope", () => {
  expect(() => acceptCpuWorker(report.innerReceipt)).not.toThrow();
  expect(admit()).toEqual({ acceptanceScope: "COMPLETE_OPERATOR_REPORT_AND_HOST_CPU39_EXIT0_ONLY", reportedCpuTests: 39, reportedLearningTests: 22, reportedPolicyTests: 17,
    reportedHarnesses: 16, reportedEmptyHarnesses: 5, reportedOfflineBuilds: 2, reportedNativeCommandsInvoked: 20, reportedCpuArtifacts: 19,
    reportedNativeSourceFiles: 65, reportedCopiedFiles: 66, reportedCopiedBytes: 663643, reportedDockerOperations: 5,
    fullMetadataConsistency: false, metadataAnomalyCount: 1, metadataAnomalies: [{ kind: "OPERATOR_REPORTED_METADATA_ANOMALY", id: "policy-io:test:f32", field: "stdoutBytes",
      outcomeStdoutBytes: 192, nativeAttemptStdoutBytes: 179, nativeStreamStdoutBytes: 179,
      disposition: "PRESERVED_VERBATIM_REPORT_ACCEPTED_BY_EXISTING_CPU_WORKER_PREDICATE_WITHOUT_BYTE_COUNT_AGREEMENT" }] });
});

test("literal inventory and complete historical plan expand without rewriting historical false approvals", () => {
  expect(report.plan).toEqual(planSnapshot); expect(report.innerReceipt.staging.inventory).toEqual(inventorySnapshot);
  expect(report.plan.status).toBe("UNAPPROVED_SOURCE_ONLY");
  for (const [key, value] of Object.entries(report.plan)) if (key.endsWith("Approved") || key.endsWith("Authorized") || key === "trainingReady") expect(value).toBe(false);
  expect(report.innerReceipt.staging).toEqual({ inventory: inventorySnapshot, copiedFiles: 66, copiedBytes: 663643, sourceManifestSha256: input.reportedInventorySnapshot.sha256 });
  expect(report.elapsedMs).toBe(267919.336645); expect(report.innerReceipt.elapsedMs).toBe(266647.54226200003);
  expect(report.state).toEqual(input.state); expect(report.cid).toBe(input.cid);
});

test("all nineteen artifact tuples retain their operator order and literal hashes and bytes", () => {
  expect(report.innerReceipt.artifacts.map(row => [row.executable.replace("/build/native/target-cpu/x86_64-unknown-linux-gnu/release/", ""), row.bytes, row.sha256])).toEqual(input.artifacts);
  expect(report.innerReceipt.artifacts.slice(16).map(row => row.executable.split("/").at(-1))).toEqual(["policy-initialize", "policy-channel", "policy-score"]);
  expect(new Set(report.innerReceipt.artifacts.map(row => row.executable)).size).toBe(19);
  for (let index = 0; index < 19; index++) {
    reject(value => { value.innerReceipt.artifacts.splice(index, 1); });
    reject(value => { value.innerReceipt.artifacts[index]!.sha256 = "0".repeat(64); });
    reject(value => { value.innerReceipt.artifacts[index]!.bytes++; });
  }
});

test("all twenty native attempts retain exact ids, supplied argv, timeouts and stream tuples", () => {
  const inner = report.innerReceipt;
  expect(inner.results).toHaveLength(20);
  expect(inner.results.map(row => [row.id, row.timeoutMs, row.stdoutBytes, row.stderrBytes, row.streams[0]!.sha256, row.stderrBytes === 0 ? null : row.streams[1]!.sha256])).toEqual(input.nativeCaptures);
  for (const [index, attempt] of inner.results.entries()) {
    expect(attempt.argv).toEqual(index < 4 ? input.nativeHeaderArgv[index]! : [inner.harnesses[index - 4]!.executable, ...input.nativeHarnessArguments]);
    expect(attempt.attempted).toBe(true); expect(attempt.commandInvoked).toBe(true); expect(attempt.status).toBe("PASS"); expect(attempt.exitCode).toBe(0); expect(attempt.failure).toBe(null);
    for (const [streamIndex, stream] of attempt.streams.entries()) {
      expect(stream.path).toBe(`/build/native/_work/gpu-owner-recovery/runs/host-cpu39-1/${attempt.id}/command.${streamIndex === 0 ? "stdout" : "stderr"}`);
      expect(stream.bytes).toBe(streamIndex === 0 ? attempt.stdoutBytes : attempt.stderrBytes);
      if (stream.bytes === 0) expect(stream.sha256).toBe(hash(""));
    }
    reject(value => { value.innerReceipt.results[index]!.commandInvoked = false; });
    reject(value => { value.innerReceipt.results[index]!.attempted = false; });
    reject(value => { value.innerReceipt.results[index]!.exitCode = 1; });
    reject(value => { value.innerReceipt.results[index]!.status = "FAIL"; });
    reject(value => { value.innerReceipt.results[index]!.streams[0]!.sha256 = "0".repeat(64); });
    reject(value => { value.innerReceipt.results[index]!.streams[0]!.path = "/unrelated/command.stdout"; });
  }
  expect(inner.results.filter(row => row.stderrBytes > 0).map(row => [row.id, row.stderrBytes])).toEqual([["cpu-learning", 4786], ["cpu-policy", 1011]]);
});

test.each(input.harnesses.map(([id, count], index) => [id, count, index] as [string, number, number]))("exact complete harness %s retains %i tests including empty execution", (id, count, index) => {
  const inner = report.innerReceipt, outcome = inner.outcome.results[index]!, harness = inner.harnesses[index]!;
  expect(harness).toEqual({ id, count, executable: inner.artifacts[index]!.executable });
  expect(outcome).toEqual({ id, status: "PASS", exitCode: 0, failure: null, accepted: true, expectedCount: count, executable: harness.executable,
    summaryCount: 1, stdoutSummaries: [`test result: ok. ${count} passed; 0 failed; 0 ignored;`],
    stdoutBytes: id === "policy-io:test:f32" ? 192 : inner.results[index + 4]!.stdoutBytes, stderrBytes: 0 });
  expect(inner.results[index + 4]!.argv).toEqual([harness.executable, "--test-threads=1", "--nocapture", "--color=never"]);
  reject(value => { value.innerReceipt.harnesses[index]!.id += "-partial"; });
  reject(value => { value.innerReceipt.harnesses[index]!.count++; });
  reject(value => { value.innerReceipt.harnesses.splice(index, 1); });
  reject(value => { value.innerReceipt.outcome.results.splice(index, 1); });
  reject(value => { value.innerReceipt.outcome.results[index]!.expectedCount++; });
  reject(value => { value.innerReceipt.outcome.results[index]!.summaryCount = 0; });
  reject(value => { value.innerReceipt.outcome.results[index]!.summaryCount = 2; });
  reject(value => { value.innerReceipt.outcome.results[index]!.accepted = false; });
  reject(value => { value.innerReceipt.outcome.results[index]!.stdoutSummaries = [`test result: ok. ${count} passed; 0 failed; 1 ignored;`]; });
  reject(value => { value.innerReceipt.outcome.results[index]!.stdoutSummaries = [`test result: ok. ${count + 1} passed; 0 failed; 0 ignored;`]; });
  reject(value => { value.innerReceipt.results[index + 4]!.argv.push("--ignored"); });
  reject(value => { value.innerReceipt.results[index + 4]!.argv.push("--exact", "some_test"); });
});

test("coverage totals derive from exact identities, not a substituted passing total", () => {
  const harnesses = report.innerReceipt.harnesses;
  expect(harnesses.reduce((sum, row) => sum + row.count, 0)).toBe(39);
  expect(harnesses.filter(row => row.id.startsWith("learning:")).reduce((sum, row) => sum + row.count, 0)).toBe(22);
  expect(harnesses.filter(row => row.id.startsWith("policy-io:")).reduce((sum, row) => sum + row.count, 0)).toBe(17);
  expect(harnesses.filter(row => row.count === 0)).toHaveLength(5);
  reject(value => { value.innerReceipt.harnesses[1]!.count--; value.innerReceipt.harnesses[2]!.count++; });
  reject(value => { [value.innerReceipt.harnesses[1], value.innerReceipt.harnesses[2]] = [value.innerReceipt.harnesses[2]!, value.innerReceipt.harnesses[1]!]; });
});

test("both offline builds and all four header commands must retain their actual argv", () => {
  for (let index = 0; index < 4; index++) {
    reject(value => { value.innerReceipt.results.splice(index, 1); });
    reject(value => { value.innerReceipt.results[index]!.argv.push("--unexpected"); });
  }
  for (const index of [2, 3]) for (const flag of ["--offline", "--locked", "--no-run", "--tests"]) reject(value => {
    const argv = value.innerReceipt.results[index]!.argv; argv.splice(argv.indexOf(flag), 1);
  });
  reject(value => { value.innerReceipt.compilationAttempts = 1; });
  const raw = structuredClone(input); raw.nativeHeaderArgv[2]!.push("--features=gpu-cuda");
  const normalized = normalizeReportedReceipt(raw);
  expect(normalized.innerReceipt.results[2]!.argv).toEqual(raw.nativeHeaderArgv[2]!);
  expect(() => acceptCpuWorker(normalized.innerReceipt)).toThrow();
});

test("directly reported compilation timeouts do not become invented actual build timings", () => {
  expect(report.innerReceipt.results.slice(2, 4).map(row => row.timeoutMs)).toEqual([1499999, 1349744]);
  for (const attempt of report.innerReceipt.results) {
    expect("elapsedMs" in attempt).toBe(false); expect("startedAtMs" in attempt).toBe(false); expect("stdout" in attempt).toBe(false);
  }
  reject(value => { value.innerReceipt.results[2]!.timeoutMs = 1500000; });
  reject(value => { value.innerReceipt.results[3]!.timeoutMs = 1500001; });
});

test("metadata anomaly preserves 192 versus 179 without falsely claiming full consistency", () => {
  const index = input.harnesses.findIndex(row => row[0] === "policy-io:test:f32");
  expect(report.innerReceipt.outcome.results[index]!.stdoutBytes).toBe(192);
  expect(report.innerReceipt.results[index + 4]!.stdoutBytes).toBe(179);
  expect(report.innerReceipt.results[index + 4]!.streams[0]!.bytes).toBe(179);
  expect(() => acceptCpuWorker(report.innerReceipt)).not.toThrow();
  expect(admit().fullMetadataConsistency).toBe(false); expect(admit().metadataAnomalyCount).toBe(1);
  reject(value => { value.innerReceipt.outcome.results[index]!.stdoutBytes = 179; });
  reject(value => { value.innerReceipt.results[index + 4]!.stdoutBytes = 192; });
  reject(value => { value.innerReceipt.results[index + 4]!.streams[0]!.bytes = 192; });
  reject(value => { Object.assign(value, { fullMetadataConsistency: true }); });
  reject(value => { Object.assign(value, { originalHostFilesReceived: true }); });
  const raw = structuredClone(input); raw.outcomeByteOverrides["policy-io:test:f32"] = 179;
  expect(normalizeReportedReceipt(raw).innerReceipt.outcome.results[index]!.stdoutBytes).toBe(179);
  expect(() => admit(normalizeReportedReceipt(raw))).toThrow();
  const capture = structuredClone(input); capture.nativeCaptures[index + 4]![2] = 192;
  expect(normalizeReportedReceipt(capture).innerReceipt.results[index + 4]!.stdoutBytes).toBe(192);
  expect(() => admit(normalizeReportedReceipt(capture))).toThrow();
});

test.each([undefined, null, -1, 1, NaN, Infinity])("absent or nonzero HOST_CPU39_EXIT %s rejects outer PASS", code => {
  expect(() => validateReportedCpuPass(report, planSnapshot, code as number)).toThrow();
});

test("source stability, exact native inventory and manifest must remain unchanged", () => {
  reject(value => { value.innerReceipt.sourceChanged = true; });
  reject(value => { value.innerReceipt.sourceStabilityChecked = false; });
  reject(value => { Object.assign(value.innerReceipt, { sourceCheckFailure: "postcheck failed" }); });
  reject(value => { value.innerReceipt.sourceManifestSha256 = "0".repeat(64); });
  reject(value => { value.innerReceipt.staging.sourceManifestSha256 = "0".repeat(64); });
  reject(value => { value.innerReceipt.staging.inventory.pop(); });
  reject(value => { value.innerReceipt.staging.inventory[0]!.sha256 = "0".repeat(64); });
  reject(value => { value.innerReceipt.staging.inventory[0]!.path += ".changed"; });
  reject(value => { value.innerReceipt.staging.copiedFiles = 65; });
  reject(value => { value.innerReceipt.staging.copiedBytes = 663642; });
  reject(value => { value.plan.cpuCoverage["policy-io:test:score"] = 8; });
});

test("every Docker operation preserves complete argv, supervisor bytes and two capture streams", () => {
  expect(report.results).toHaveLength(5); expect(report.captures).toHaveLength(5);
  expect(report.captures.map(row => [row.id, row.streams[0]!.bytes, row.streams[0]!.sha256])).toEqual(input.dockerCaptures);
  expect(report.results[0]!.argv).toEqual(input.dockerCreateArgv);
  for (const [index, row] of report.results.entries()) {
    expect(row.supervisorResult).toEqual({ status: "PASS", exitCode: 0, failure: null, stdoutBytes: row.stdoutBytes, stderrBytes: 0 });
    expect(Object.keys(row).sort()).toEqual(["id", "argv", "status", "exitCode", "failure", "stdoutBytes", "stderrBytes", "supervisorResult"].sort());
    const capture = report.captures[index]!;
    expect(Object.keys(capture).sort()).toEqual(["id", "streams"]);
    expect(capture.streams).toEqual([
      { path: `/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/runs/host-cpu39-1/${row.id}/command.stdout`, bytes: row.stdoutBytes, sha256: input.dockerCaptures[index]![2] as string },
      { path: `/home/gu1lty/Projects/proveo/chess-coach/_work/gpu-owner-recovery/runs/host-cpu39-1/${row.id}/command.stderr`, bytes: 0, sha256: hash("") },
    ]);
    reject(value => { value.results.splice(index, 1); });
    reject(value => { value.results[index]!.argv.push("--privileged"); });
    reject(value => { value.results[index]!.exitCode = 1; });
    reject(value => { value.results[index]!.supervisorResult.stdoutBytes++; });
    reject(value => { value.captures[index]!.streams[0]!.sha256 = "0".repeat(64); });
    reject(value => { Object.assign(value.results[index]!, { timeoutMs: 120000 }); });
    reject(value => { Object.assign(value.captures[index]!, { captureFailures: [] }); });
  }
  const raw = structuredClone(input); raw.dockerCreateArgv.push("--privileged");
  expect(normalizeReportedReceipt(raw).results[0]!.argv.at(-1)).toBe("--privileged");
  expect(() => admit(normalizeReportedReceipt(raw))).toThrow();
});

test("cleanup, terminal state and finalization require the literal successful HOST report", () => {
  reject(value => { value.state.Status = "running"; });
  reject(value => { value.state.Running = true; });
  reject(value => { value.state.ExitCode = 1; });
  reject(value => { value.state.OOMKilled = true; });
  reject(value => { value.state.Dead = true; });
  reject(value => { value.cleanupFailures.push("remove failed"); });
  reject(value => { value.finalizationSignalObserved = true; });
  reject(value => { value.receiptStatusRequiresZeroHostMarker = false; });
  reject(value => { Object.assign(value, { failure: "late failure" }); });
  reject(value => { value.innerReceipt.phase = "compilation"; });
  reject(value => { Object.assign(value.innerReceipt, { failurePhase: "compilation" }); });
  reject(value => { value.innerReceipt.outcome.status = "FAIL_TEST"; });
});

test("remaining allowance, CPU-only and excluded execution/readiness flags cannot be promoted", () => {
  reject(value => { value.remainingHostInvocations = 1; }); reject(value => { value.hostInvocationsConsumed = 0; });
  reject(value => { value.automaticRetryAuthorized = true; }); reject(value => { value.cpuOnly = false; });
  reject(value => { value.gpuDevicesRequested = true; }); reject(value => { value.gpuExecuted = true; });
  reject(value => { value.trainingExecuted = true; }); reject(value => { value.trainingReady = true; });
  reject(value => { value.innerReceipt.cpuOnly = false; }); reject(value => { value.innerReceipt.gpuExecuted = true; });
  reject(value => { value.innerReceipt.llvmExecuted = true; }); reject(value => { value.innerReceipt.trainingExecuted = true; }); reject(value => { value.innerReceipt.trainingReady = true; });
  reject(value => { value.workspaceIsFilesystemQuota = true; }); reject(value => { value.dockerWritableLayerIncludedInWorkspaceAccounting = true; });
  reject(value => { value.limitsAreTrialCapsNotFitGuarantees = false; });
});

async function memoryIO() {
  const files = new Map(await Promise.all(snapshotPaths.map(async path => [path, await readFile(path)] as const)));
  const writes: string[] = [];
  return { files, writes, io: { read: async (path: string) => {
    const bytes = files.get(path); if (bytes === undefined) throw Object.assign(Error("absent"), { code: "ENOENT" }); return bytes;
  }, write: async (path: string, text: string) => {
    expect(path.startsWith(reportRoot)).toBe(true); expect(files.has(path)).toBe(false);
    files.set(path, Buffer.from(text)); writes.push(path);
  } } };
}

test("mock receipt-only e2e writes exactly three normalized records and re-receives without writes", async () => {
  const memory = await memoryIO(), first = await receiveReportedPass(memory.io);
  expect(first.report).toEqual(report); expect(memory.writes).toEqual(["reported-receipt.json", "operator-summary.txt", "observation.json"].map(name => reportRoot + name));
  expect(first.summary).toBe(JSON.stringify(input.summary) + "\nHOST_CPU39_EXIT=0\n");
  const writes = [...memory.writes], second = await receiveReportedPass(memory.io);
  expect(second).toEqual(first); expect(memory.writes).toEqual(writes);
  expect(JSON.parse(memory.files.get(reportRoot + "reported-receipt.json")!.toString())).toEqual(report);
  for (const path of snapshotPaths) expect(memory.files.get(path)).toEqual(await readFile(path));
});

test.each(["reported-receipt.json", "operator-summary.txt", "observation.json"])("existing unequal %s remains immutable and refuses replacement", async name => {
  const memory = await memoryIO(); await receiveReportedPass(memory.io);
  const path = reportRoot + name, changed = Buffer.from(memory.files.get(path)!.toString() + "changed\n"); memory.files.set(path, changed);
  const writes = [...memory.writes]; await expect(receiveReportedPass(memory.io)).rejects.toThrow("IMMUTABLE_REPORT_RECORD_DIFFERS");
  expect(memory.files.get(path)).toEqual(changed); expect(memory.writes).toEqual(writes);
});

test.each(snapshotPaths.slice(0, 4))("input or snapshot alteration refuses normalization before writing: %s", async path => {
  const memory = await memoryIO(); memory.files.set(path, Buffer.from(memory.files.get(path)!.toString() + " \n"));
  await expect(receiveReportedPass(memory.io)).rejects.toThrow(); expect(memory.writes).toEqual([]);
});

test("mock e2e refuses renewed publication, text delivery or HOST grant projections", async () => {
  for (const [path, field] of [
    [snapshotPaths[4]!, "remainingNormalCommits"], [snapshotPaths[4]!, "remainingHttpsPushes"],
    [snapshotPaths[5]!, "remainingManualCommandTextDeliveries"], [snapshotPaths[6]!, "newHostAttemptOrRetryAuthorized"],
    [snapshotPaths[7]!, "remainingExactTextRedeliveries"], [snapshotPaths[7]!, "remainingNormalCommits"], [snapshotPaths[7]!, "remainingHttpsPushes"],
  ]) {
    const memory = await memoryIO(), value = JSON.parse(memory.files.get(path!)!.toString());
    value[field!] = field === "newHostAttemptOrRetryAuthorized" ? true : 1; memory.files.set(path!, Buffer.from(JSON.stringify(value)));
    await expect(receiveReportedPass(memory.io)).rejects.toThrow(); expect(memory.writes).toEqual([]);
  }
});

test("persisted observation binds real metadata snapshots and consumes only existing authority", async () => {
  const { observation, summary } = await receiveReportedPass();
  expect(JSON.parse(await readFile(reportRoot + "reported-receipt.json", "utf8"))).toEqual(report);
  expect(JSON.parse(await readFile(reportRoot + "observation.json", "utf8"))).toEqual(observation);
  expect(await readFile(reportRoot + "operator-summary.txt", "utf8")).toBe(summary);
  expect(observation.provenance).toBe(input.provenance); expect(observation.acceptanceScope).toBe("COMPLETE_OPERATOR_REPORT_AND_HOST_CPU39_EXIT0_ONLY");
  expect(observation.grantId).toBe("cpu39-manual-grant-1"); expect(observation.maximumCombinedManualHostAttempts).toBe(1);
  expect(observation.hostInvocationsConsumed).toBe(1); expect(observation.remainingHostInvocations).toBe(0);
  expect(observation.maximumNativeBuildInvocations).toBe(2); expect(observation.nativeBuildInvocationsConsumed).toBe(2); expect(observation.remainingNativeBuildInvocations).toBe(0);
  for (const value of [observation, observation.freshRedelivery]) { expect(value.remainingNormalCommits).toBe(0); expect(value.remainingHttpsPushes).toBe(0); }
  expect(observation.remainingManualCommandTextDeliveries).toBe(0); expect(observation.freshRedelivery.remainingExactTextRedeliveries).toBe(0);
  expect(observation.freshRedelivery.publishedCommit).toBe("6fdc92c7eb90eb625e6d54c6a448009d5db34423"); expect(observation.freshRedelivery.hostAttemptOrRetryRenewed).toBe(false);
  expect(observation.issuedApproval.path).toBe(deliveryRoot + "approval.json"); expect(hash(await readFile(observation.issuedApproval.path))).toBe(observation.issuedApproval.sha256);
  expect(observation.reportedInput.sha256).toBe("6600db06b805f63e561bd4e56d4f2bc9f23aea13e6a4ce6b74ab304522e52673");
  expect(observation.snapshots[1]!.sha256).toBe("fb146d38205f378dccb8e7520c0b134642f8c44effcef2722326d69ed0e2467d");
  expect(observation.snapshots[2]!.sha256).toBe("7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec");
  for (const binding of observation.snapshots) { const bytes = await readFile(binding.path); expect(binding.sha256).toBe(hash(bytes)); expect(binding.bytes).toBe(bytes.length); }
  expect(observation.metadataAnomalies).toEqual(admit().metadataAnomalies); expect(observation.fullMetadataConsistency).toBe(false);
  expect(observation.normalization.nativeCompilationTimeoutsMs).toEqual([1499999, 1349744]); expect(observation.normalization.actualPerBuildElapsedMs).toBe(null);
  for (const field of ["originalHostFilesReceived", "originalCaptureOrJournalBytesReceived", "originalCaptureOrJournalBytesRehashed", "actualHostCommandBytesIndependentlyVerified",
    "reportAcceptanceRequiresOriginalByteCustody", "fullAssuranceQualified", "canonicalBothQualified", "referenceQualified", "integratedR4Qualified", "operationalWiringQualified",
    "cpuReportContainsGpuProof", "generalStorageFitAssurance", "generalReadOnlyRegistryCompatibilityAssurance", "filesystemQuotaEstablished", "cpuRerunRequired", "gpuRerunRequired",
    "automaticRetryAuthorized", "newHostOrNativeExecutionAuthorized", "newGpuOrLlvmExecutionAuthorized", "newPublicationAuthorized", "newManualCommandDeliveryAuthorized", "experimentTrainingAuthorized", "trainingReady", "hardeningPerformed"] as const) expect(observation[field]).toBe(false);
  expect(observation.normalization.buildTimingInferredFromTimeoutDifference).toBe(false); expect(observation.normalization.rawNativeStdoutReconstructed).toBe(false);
  expect(observation.normalization.originalHostByteHashingPerformed).toBe(false); expect(observation.normalization.outerDockerTimeoutsNotSuppliedAndNotInvented).toBe(true);
  expect(observation.trialStorageFitDemonstratedForThisOneReportedRunOnly).toBe(true); expect(observation.readOnlyRegistryIndexCompatibilityDemonstratedForThisOneReportedRunOnly).toBe(true);
  expect(observation.previouslyAcceptedFullGpuAndC12ResultUnchanged).toBe(true); expect(observation.hardeningDeferredUntilAllPlannedTrainingCompleteAndResultsValidated).toBe(true);
  const path = reportRoot + "mock-e2e.json", text = JSON.stringify({ status: "PASS_MOCK_REPORT_RECEIVE_ONLY", reportedCpuTests: 39, reportedHarnesses: 16,
    nativeCommandsReportedNotExecuted: 20, metadataAnomalyPreserved: true, fullMetadataConsistency: false, originalHostFilesReceived: false,
    actualHostExecuted: false, actualNativeExecuted: false, actualGpuExecuted: false, automaticRetryAuthorized: false, hostGrantConsumedByLocalTests: 0, trainingReady: false }, null, 2) + "\n";
  try { expect(await readFile(path, "utf8")).toBe(text); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await writeFile(path, text, { flag: "wx" }); }
});

test("local verifier admits only fresh bounded labels and named pure tests plus strict TSC", () => {
  for (const label of ["verification-1", "verification-99"]) expect(verificationDirectory(label)).toEndWith(reportRoot + label);
  for (const label of ["verification-0", "verification-100", "verification-01", "verification-1/../../escape", " verification-1", "verification-1\n", "other"]) expect(() => verificationDirectory(label)).toThrow();
  const commands = verificationCommands(); expect(commands.map(row => row.id)).toEqual(["records", "unit-and-mock-e2e", "strict-types"]);
  for (const command of commands) expect(command.argv.slice(0, 3)).toEqual(["/usr/local/bin/bun", "--no-env-file", "--no-install"]);
  expect(commands[1]!.argv.slice(3)).toEqual(["test", "./" + reportRoot + "records.test.ts"]);
  for (const flag of ["--noEmit", "--strict", "--noUnusedLocals", "--noUnusedParameters", "--resolveJsonModule"]) expect(commands[2]!.argv).toContain(flag);
  expect(commands[2]!.argv.filter(arg => arg.endsWith(".ts"))).toEqual(["records.ts", "records.test.ts", "verify.ts"].map(name => reportRoot + name));
});
