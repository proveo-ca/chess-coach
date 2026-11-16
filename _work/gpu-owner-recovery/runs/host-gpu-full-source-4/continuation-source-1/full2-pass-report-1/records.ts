// SPEC: _spec/gpu-full-qualification.puml
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import input from "./reported-input.json";
import { fullCreate } from "../../../../qualification/host-full/host";
import { fullPaths, fullSelectors, type FullPlan } from "../../../../qualification/host-full/plan";
import { docker } from "../../../../qualification/host-build/build";
import { makeProgressGuard, telemetryArgv } from "../../../../qualification/host-feasibility/guard";
import { testPassed } from "../../../../../../tooling/runtime/qualification";

export const reportRoot = "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/continuation-source-1/full2-pass-report-1/";
const hostRoot = "/home/gu1lty/Projects/proveo/chess-coach", runId = "host-gpu-full-2";
const nativePrefix = "/build/native/target-gpu/x86_64-unknown-linux-gnu/release/";
const guestRuns = "/build/native/_work/gpu-owner-recovery/runs/" + runId;
const hostEvidence = hostRoot + "/_work/gpu-owner-recovery/runs/" + runId;
export const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const emptyHash = hash("");
const streams = (directory: string, bytes: number, sha256: string) => [
  { path: directory + "/command.stdout", bytes, sha256 },
  { path: directory + "/command.stderr", bytes: 0, sha256: emptyHash },
];

export function normalizeReportedReceipt(raw = input) {
  const c = raw.reportedCommon;
  const command = { status: c.commandStatus, exitCode: c.commandExitCode, failure: c.failure };
  const commandExit = { exitCode: c.commandExitCode, failure: c.failure }, cleanupFailures: string[] = [...c.cleanupFailures];
  const unqualified = { trainingReady: c.trainingReady, canonicalBothQualified: c.canonicalBothQualified, integratedR4Qualified: c.integratedR4Qualified,
    operationalTelemetryQualified: c.operationalTelemetryQualified, fullAssuranceQualified: c.fullAssuranceQualified, trainingExecuted: c.trainingExecuted };
  const artifacts = raw.artifacts.map(row => {
    assert.equal(row.length, 3); assert.equal(typeof row[0], "string"); assert.equal(typeof row[1], "number"); assert.equal(typeof row[2], "string");
    const [suffix, bytes, sha256] = row as [string, number, string], executable = nativePrefix + suffix;
    return { path: executable, executable, bytes, sha256 };
  });
  const results = raw.tests.map(row => {
    assert.equal(row.length, 4); assert.equal(typeof row[0], "string"); assert.equal(typeof row[1], "number"); assert.equal(typeof row[2], "string"); assert.equal(typeof row[3], "string");
    const [id, stdoutBytes, stdoutHash] = row as [string, number, string, string];
    const executable = artifacts[id.startsWith("cuda_feature_") ? 0 : 1]!.executable, captureDirectory = guestRuns + "/" + id;
    return { id, argv: [executable, id, "--exact", "--ignored", "--test-threads=1", "--nocapture", "--color=never"], timeoutMs: 120000,
      attempted: c.allTestsAndQueriesAttempted, status: c.commandStatus, commandInvoked: c.allTestCommandsInvoked, captureDirectory,
      commandResult: { ...command, stdoutBytes, stderrBytes: 0 }, ...commandExit, stdoutBytes, stderrBytes: 0,
      streams: streams(captureDirectory, stdoutBytes, stdoutHash), captureFailures: [...c.captureFailures] };
  });
  const qualificationResults = raw.tests.map(row => ({ id: row[0] as string, ...command, stdoutSummaries: [row[3] as string], accepted: c.qualificationAccepted }));
  const samples = raw.telemetryRows.map(([queryStartedAtMs, observedAtMs, freeBytes], i) => ({ uuid: raw.selectedUuid, freeBytes: freeBytes!, totalBytes: raw.totalGpuBytes, query: i + 1, queryStartedAtMs: queryStartedAtMs!, observedAtMs: observedAtMs! }));
  const queries = samples.map(sample => {
    const id = "telemetry-" + String(sample.query).padStart(4, "0"), captureDirectory = guestRuns + "/" + id;
    const stdoutHash = raw.telemetryStdoutHashesByFreeBytes[String(sample.freeBytes) as keyof typeof raw.telemetryStdoutHashesByFreeBytes];
    assert.match(stdoutHash, /^[a-f0-9]{64}$/);
    return { id, argv: telemetryArgv({ selectedUuid: raw.selectedUuid }), timeoutMs: 1000, attempted: c.allTestsAndQueriesAttempted, status: c.commandStatus,
      query: sample.query, queryStartedMs: sample.queryStartedAtMs, captureDirectory, commandResult: { ...command, stdoutBytes: raw.telemetryStdoutBytes, stderrBytes: 0 },
      ...commandExit, stdoutBytes: raw.telemetryStdoutBytes, stderrBytes: 0, streams: streams(captureDirectory, raw.telemetryStdoutBytes, stdoutHash), captureFailures: [...c.captureFailures] };
  });
  const dockerArgv = [raw.dockerCreateArgv, ["docker", "--host=unix:///var/run/docker.sock", "start", raw.worker],
    ["docker", "--host=unix:///var/run/docker.sock", "logs", "--follow", raw.worker],
    ["docker", "--host=unix:///var/run/docker.sock", "container", "inspect", "--format", "{{json .State}}", raw.worker],
    ["docker", "--host=unix:///var/run/docker.sock", "rm", raw.worker]];
  const dockerResults = raw.dockerStreams.map((row, i) => {
    assert.equal(row.length, 4); assert.equal(typeof row[0], "string"); assert.equal(typeof row[1], "number"); assert.equal(typeof row[2], "number"); assert.equal(typeof row[3], "string");
    const [id, timeoutMs, stdoutBytes, stdoutHash] = row as [string, number, number, string];
    return { id, argv: dockerArgv[i]!, timeoutMs, ...command, stdoutBytes, stderrBytes: 0, supervisorResult: { ...command },
      streams: streams(hostEvidence + "/" + id, stdoutBytes, stdoutHash), captureFailures: [...c.captureFailures] };
  });
  return { version: "chess-coach.owned-gpu-full.v1", status: c.outerStatus, failure: c.failure, cleanupFailures, ids: { worker: raw.worker }, state: { ...raw.state },
    innerReceipt: { version: "chess-coach.gpu-full-driver.v1", runId, status: c.innerStatus, failure: c.failure, sourceStabilityChecked: c.sourceStabilityChecked,
      sourceChanged: c.sourceChanged, sourceCheckFailure: c.sourceCheckFailure, sourceManifestSha256: raw.sourceManifestSha256, artifacts, results, qualificationResults,
      telemetry: { samples, queries, events: { ...raw.events } }, testLoopLimits: { perTestMs: 120000, totalMs: 750000, cleanupReserveMs: 30000 }, elapsedMs: raw.innerElapsedMs,
      campaignInvocationsConsumed: c.campaignInvocationsConsumed, remainingCampaignInvocations: c.remainingCampaignInvocations, automaticRetryAuthorized: c.automaticRetryAuthorized,
      outputBytesPerStreamLimit: 4194304, ...unqualified },
    guardComplete: c.guardComplete, results: dockerResults, elapsedMs: raw.outerElapsedMs, gpuExecutionAttempted: c.gpuExecutionAttempted,
    testExecutionAttempted: c.testExecutionAttempted, testsExecuted: c.testsExecuted, hostInvocationsConsumed: c.hostInvocationsConsumed,
    remainingHostInvocations: c.remainingHostInvocations, automaticRetryAuthorized: c.automaticRetryAuthorized, qualificationImageBuilt: c.qualificationImageBuilt,
    ...unqualified, captures: dockerResults.map(result => ({ id: result.id, streams: result.streams, captureFailures: [...c.captureFailures] })),
    workspace: "_work/gpu-owner-recovery/cache/" + runId, evidence: "_work/gpu-owner-recovery/runs/" + runId, requestedResources: { ...raw.requestedResources }, limits: { ...raw.limits },
    retainedInputsReadOnly: c.retainedInputsReadOnly, mutableRetainedCaches: [...c.mutableRetainedCaches], receiptStatusRequiresZeroHostMarker: c.receiptStatusRequiresZeroHostMarker,
    finalizationSignalObserved: c.finalizationSignalObserved, parentDiagnosticsHaveOnlyPostExitSoftSizeCheck: c.parentDiagnosticsHaveOnlyPostExitSoftSizeCheck,
    workspaceIsFilesystemQuota: c.workspaceIsFilesystemQuota, dockerWritableLayerIncludedInWorkspaceAccounting: c.dockerWritableLayerIncludedInWorkspaceAccounting };
}

export function validateReportedFullPass(report: ReturnType<typeof normalizeReportedReceipt>, plan: FullPlan, hostExitCode: number) {
  assert.equal(hostExitCode, 0); assert.equal(report.status, "PASS_HOST_GPU_FULL_ONLY"); assert.equal(report.failure, null);
  assert.equal(report.version, "chess-coach.owned-gpu-full.v1"); assert.deepEqual(report.cleanupFailures, []);
  assert.match(report.ids.worker, /^[a-f0-9]{64}$/); assert.equal(report.state.Status, "exited"); assert.equal(report.state.Running, false); assert.equal(report.state.ExitCode, 0); assert.equal(report.state.OOMKilled, false);
  assert.equal(report.guardComplete, true); assert.equal(report.gpuExecutionAttempted, true); assert.equal(report.testExecutionAttempted, true); assert.equal(report.testsExecuted, true);
  assert.equal(report.hostInvocationsConsumed, 1); assert.equal(report.remainingHostInvocations, 0); assert.equal(report.automaticRetryAuthorized, false);
  assert.deepEqual(report.requestedResources, plan.resources); assert.deepEqual(report.limits, plan.limits);
  assert.equal(report.workspace, plan.workspace); assert.equal(report.evidence, plan.evidence); assert.equal(report.retainedInputsReadOnly, true); assert.deepEqual(report.mutableRetainedCaches, []);
  assert.equal(report.receiptStatusRequiresZeroHostMarker, true); assert.equal(report.finalizationSignalObserved, false);
  assert.equal(report.parentDiagnosticsHaveOnlyPostExitSoftSizeCheck, true);
  assert.ok(report.elapsedMs > 0 && report.elapsedMs <= plan.limits.normalOperationsMs);
  const inner = report.innerReceipt;
  assert.equal(inner.version, "chess-coach.gpu-full-driver.v1"); assert.equal(inner.runId, plan.runId); assert.equal(inner.status, "PASS_GPU_FULL_TESTS_ONLY"); assert.equal(inner.failure, null);
  assert.equal(inner.sourceStabilityChecked, true); assert.equal(inner.sourceChanged, false); assert.equal(inner.sourceCheckFailure, null); assert.equal(inner.sourceManifestSha256, plan.sourceManifestSha256);
  assert.equal(inner.campaignInvocationsConsumed, 1); assert.equal(inner.remainingCampaignInvocations, 0); assert.equal(inner.automaticRetryAuthorized, false);
  assert.equal(inner.outputBytesPerStreamLimit, 4194304);
  assert.deepEqual(inner.testLoopLimits, plan.testLoop); assert.ok(inner.elapsedMs > 0 && inner.elapsedMs <= plan.limits.nativeWorkMs);
  assert.deepEqual(inner.artifacts.map(({ executable, bytes, sha256 }) => ({ executable, bytes, sha256 })), plan.artifacts.map(({ executable, bytes, sha256 }) => ({ executable, bytes, sha256 })));
  for (const artifact of inner.artifacts) assert.equal(artifact.path, artifact.executable);
  assert.deepEqual(inner.results.map(result => result.id), [...fullSelectors]); assert.deepEqual(inner.qualificationResults.map(result => result.id), [...fullSelectors]);
  for (const [i, result] of inner.results.entries()) {
    const qualified = inner.qualificationResults[i]!;
    assert.equal(result.attempted, true); assert.equal(result.commandInvoked, true); assert.equal(result.timeoutMs, plan.testLoop.perTestMs);
    assert.deepEqual(result.argv, [inner.artifacts[result.id.startsWith("cuda_feature_") ? 0 : 1]!.executable, result.id, "--exact", "--ignored", "--test-threads=1", "--nocapture", "--color=never"]);
    assert.deepEqual(result.captureFailures, []); assert.equal(result.captureDirectory, guestRuns + "/" + result.id);
    assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0); assert.equal(result.failure, null);
    assert.deepEqual(result.commandResult, { status: "PASS", exitCode: 0, failure: null, stdoutBytes: result.stdoutBytes, stderrBytes: 0 });
    assert.equal(result.stdoutBytes, input.tests[i]![1]); assert.equal(result.stderrBytes, 0);
    assert.deepEqual(result.streams, streams(result.captureDirectory, result.stdoutBytes, input.tests[i]![2] as string));
    assert.equal(qualified.accepted, true); assert.equal(qualified.stdoutSummaries.length, 1);
    assert.ok(testPassed({ ...qualified, stdout: qualified.stdoutSummaries.join("\n") }, 1));
  }
  assert.equal(inner.telemetry.samples.length, 113); assert.equal(inner.telemetry.queries.length, 113);
  let now = 0; const guard = makeProgressGuard(plan, () => now);
  for (const [i, sample] of inner.telemetry.samples.entries()) {
    const query = inner.telemetry.queries[i]!;
    now = sample.queryStartedAtMs; assert.deepEqual(guard.startQuery(), { query: i + 1, queryStartedAtMs: now });
    now = sample.observedAtMs;
    const csv = `${sample.uuid}, ${sample.freeBytes / 1048576}, ${sample.totalBytes / 1048576}\n`;
    assert.deepEqual(guard.accept(csv), sample);
    assert.equal(query.id, "telemetry-" + String(i + 1).padStart(4, "0")); assert.deepEqual(query.argv, telemetryArgv(plan)); assert.equal(query.timeoutMs, plan.guard.queryTimeoutMs);
    assert.equal(query.query, i + 1); assert.equal(query.queryStartedMs, sample.queryStartedAtMs); assert.equal(query.attempted, true);
    assert.equal(query.captureDirectory, guestRuns + "/" + query.id); assert.deepEqual(query.captureFailures, []);
    assert.deepEqual(query.commandResult, { status: "PASS", exitCode: 0, failure: null, stdoutBytes: 53, stderrBytes: 0 });
    assert.equal(query.status, "PASS"); assert.equal(query.exitCode, 0); assert.equal(query.failure, null);
    assert.equal(Buffer.byteLength(csv), query.stdoutBytes); assert.equal(hash(csv), query.streams[0]!.sha256);
    assert.deepEqual(query.streams, streams(query.captureDirectory, query.stdoutBytes, hash(csv))); assert.equal(query.stderrBytes, 0);
  }
  now = inner.elapsedMs; guard.check(); assert.equal(guard.snapshot().failure, null); assert.equal(guard.snapshot().pending, null);
  assert.equal(guard.snapshot().queries, 113); assert.equal(inner.telemetry.events.writeFailed, false);
  assert.equal(inner.telemetry.events.count, 127); assert.equal(inner.telemetry.events.lastSequence, 127); assert.equal(inner.telemetry.events.bytes, 29403); assert.equal(inner.telemetry.events.attemptedBytes, 29403);
  assert.equal(inner.telemetry.events.path, "/evidence/inner/events.ndjson"); assert.equal(inner.telemetry.events.sha256, "9396c821a25a879249914998e6d2e5cb466d753c54df0069f5148d2e974bd021");
  const paths = fullPaths(hostRoot, plan), cid = report.ids.worker;
  assert.deepEqual(report.results.map(result => result.id), ["worker-create", "worker-start", "worker-logs", "worker-state", "worker-remove"]);
  assert.deepEqual(report.results.map(result => result.argv), [fullCreate(plan, paths, 1000, 1000), docker(plan, "start", cid), docker(plan, "logs", "--follow", cid), docker(plan, "container", "inspect", "--format", "{{json .State}}", cid), docker(plan, "rm", cid)]);
  assert.deepEqual(report.results.map(result => result.timeoutMs), [20000, 20000, 890000, 10000, 15000]);
  for (const result of report.results) {
    assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0); assert.equal(result.failure, null); assert.deepEqual(result.captureFailures, []);
    assert.deepEqual(result.supervisorResult, { status: "PASS", exitCode: 0, failure: null });
    assert.deepEqual(result.streams, streams(hostEvidence + "/" + result.id, result.stdoutBytes, result.streams[0]!.sha256));
  }
  assert.deepEqual(report.captures, report.results.map(result => ({ id: result.id, streams: result.streams, captureFailures: [] })));
  const allStreams = [...inner.results, ...inner.telemetry.queries, ...report.results, ...report.captures].flatMap(result => result.streams);
  for (const stream of allStreams) {
    assert.ok(Number.isSafeInteger(stream.bytes) && stream.bytes >= 0 && stream.bytes <= 4194304); assert.match(stream.sha256, /^[a-f0-9]{64}$/);
    if (stream.bytes === 0) assert.equal(stream.sha256, emptyHash);
  }
  assert.equal(allStreams.length, 258); assert.equal(new Set(allStreams.map(stream => stream.path)).size, 248);
  for (const value of [report, inner]) for (const key of ["trainingReady", "canonicalBothQualified", "integratedR4Qualified", "operationalTelemetryQualified", "fullAssuranceQualified", "trainingExecuted"] as const) assert.equal(value[key], false);
  assert.equal(report.qualificationImageBuilt, false); assert.equal(report.workspaceIsFilesystemQuota, false); assert.equal(report.dockerWritableLayerIncludedInWorkspaceAccounting, false);
  return { reportedGpuTests: 6, finiteDifferenceCoordinates: 4670, reportedArtifacts: inner.artifacts.length, reportedArtifactBytes: inner.artifacts.reduce((sum, value) => sum + value.bytes, 0),
    reportedTelemetrySamples: 113, reportedCompleteDockerArgv: 5, reportedStreamMetadataReferences: allStreams.length, reportedUniqueStreamPaths: new Set(allStreams.map(stream => stream.path)).size,
    minimumReportedFreeBytes: Math.min(...inner.telemetry.samples.map(sample => sample.freeBytes)),
    minimumReportedQueryStartGapMs: Math.min(...inner.telemetry.samples.slice(1).map((sample, i) => sample.queryStartedAtMs - inner.telemetry.samples[i]!.queryStartedAtMs)),
    maximumReportedQueryLatencyMs: Math.max(...inner.telemetry.samples.map(sample => sample.observedAtMs - sample.queryStartedAtMs)) };
}

const preserve = async (name: string, text: string) => {
  const file = new URL(name, import.meta.url);
  try { assert.equal(await readFile(file, "utf8"), text); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await writeFile(file, text, { flag: "wx" }); }
};

export async function receiveReportedPass() {
  const plan: FullPlan = JSON.parse(await readFile(new URL("../../plan.json", import.meta.url), "utf8"));
  const report = normalizeReportedReceipt(), facts = validateReportedFullPass(report, plan, input.hostExitCode);
  assert.equal(input.provenance, "SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES");
  const approvalPath = reportRoot.replace("full2-pass-report-1/", "full2-status-report-1/fresh-manual-host-approval.json");
  const approvalBytes = await readFile(approvalPath), approval = JSON.parse(approvalBytes.toString());
  assert.equal(hash(approvalBytes), "7030c3b743a98c9c8a5d03a0450361907c67343cd3b7ec80809682fa676012fe");
  assert.equal(approval.grantId, "full2-manual-grant-1");
  await preserve("reported-receipt.json", JSON.stringify(report, null, 2) + "\n");
  await preserve("operator-summary.txt", JSON.stringify({ status: report.status, failure: report.failure, receipt: report.evidence + "/receipt.json", trainingReady: false }) + "\nHOST_GPU_FULL_EXIT=0\n");
  await preserve("observation.json", JSON.stringify({ status: "OPERATOR_REPORTED_FULL_SIX_GPU_F64_NUMERICAL_AND_C12_PASS_CONSUMED", provenance: input.provenance,
    reportedReceipt: reportRoot + "reported-receipt.json", reportedInput: reportRoot + "reported-input.json", reportedHostExitCode: 0,
    issuedApproval: { path: approvalPath, sha256: hash(approvalBytes) }, sourceManifestSha256: report.innerReceipt.sourceManifestSha256, ...facts,
    reportedFullSixPassed: true, reportedSourceUnchanged: true, reportedGuardComplete: true, reportedOwnedCleanupPassed: true,
    reportedHostElapsedMs: report.elapsedMs, hostInvocationsConsumed: 1, remainingHostInvocations: 0, campaignInvocationsConsumed: 1, remainingCampaignInvocations: 0,
    replacementTextDeliveriesConsumed: 1, remainingReplacementTextDeliveries: 0, priorTerminalOutcomeRemainsHistoricalUnknown: true,
    originalHostFilesReceived: false, actualHostCommandBytesIndependentlyVerified: false, originalCaptureOrJournalBytesRehashed: false, reportedCsvReconstructionConsistencyOnly: true,
    cpu39Qualified: false, canonicalBothQualified: false, integratedR4Qualified: false, operationalWiringQualified: false, fullAssuranceQualified: false,
    automaticRetryAuthorized: false, newHostOrGpuExecutionAuthorized: false, experimentTrainingAuthorized: false, trainingReady: false }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "PASS_OPERATOR_REPORTED_FULL_SIX_RECORDS_ONLY", ...facts, trainingReady: false }));
}

if (import.meta.main && Bun.argv[2] === "--receive-report") await receiveReportedPass();
