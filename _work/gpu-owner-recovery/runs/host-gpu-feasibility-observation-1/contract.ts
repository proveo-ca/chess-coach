// SPEC: _spec/gpu-feasibility.puml
import { deepStrictEqual } from "node:assert";
import { acceptInner, feasibilityCreate } from "../../qualification/host-feasibility/host";
import { feasibilityPaths, type FeasibilityPlan } from "../../qualification/host-feasibility/plan";
import { makeProgressGuard, telemetryArgv } from "../../qualification/host-feasibility/guard";
import { docker } from "../../qualification/host-build/build";
import { testPassed } from "../../../../tooling/runtime/qualification";

const check = (value: unknown, reason: string) => { if (!value) throw Error(reason); };
const emptySha = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
function captures(row: any, directory: string) {
  check(row.streams?.length === 2, "REPORTED_CAPTURE_PAIR_REQUIRED");
  for (const [i, stream] of ["stdout", "stderr"].entries()) {
    const metadata = row.streams[i];
    check(metadata.path === directory + "/command." + stream && metadata.bytes === row[stream + "Bytes"]
      && Number.isSafeInteger(metadata.bytes) && metadata.bytes >= 0 && metadata.bytes <= 4194304
      && /^[a-f0-9]{64}$/.test(metadata.sha256) && (metadata.bytes !== 0 || metadata.sha256 === emptySha), "REPORTED_CAPTURE_METADATA_REQUIRED");
  }
  deepStrictEqual(row.captureFailures, []);
}
function passed(row: any, attempted: boolean) {
  check(row.status === "PASS" && row.exitCode === 0 && row.failure === null && (!attempted || row.attempted === true), "REPORTED_COMMAND_PASS_REQUIRED");
}

export function validateReportedFeasibility(report: any, request: any, plan: FeasibilityPlan, summary: string) {
  const lines = summary.trimEnd().split("\n"), frame = JSON.parse(lines[0]!);
  check(lines.length === 2 && lines[1] === "HOST_GPU_FEASIBILITY_EXIT=0" && frame.status === "PASS_HOST_GPU_FEASIBILITY_ONLY" && frame.failure === null
    && frame.trainingReady === false && frame.receipt === plan.evidence + "/receipt.json", "PASS_FRAME_AND_ZERO_HOST_MARKER_REQUIRED");
  check(request.maximumHostInvocations === 1 && request.hostExecutionApproved === true && request.gpuExecutionApproved === true
    && request.runtimeLlvmNvptxCudaKernelJitApproved === true && request.runId === plan.runId, "ISSUED_ONE_SHOT_SCOPE_REQUIRED");
  check(report.version === "chess-coach.owned-gpu-feasibility.v1" && report.status === "PASS_HOST_GPU_FEASIBILITY_ONLY" && report.failure === null, "REPORTED_FEASIBILITY_PASS_REQUIRED");
  deepStrictEqual(report.cleanupFailures, []); deepStrictEqual(report.requestedResources, plan.resources); deepStrictEqual(report.limits, plan.limits);
  const inner = report.innerReceipt;
  check(inner.version === "chess-coach.gpu-feasibility-driver.v1" && inner.runId === plan.runId, "MATCHING_DRIVER_GENERATION_REQUIRED");
  acceptInner(plan, inner);
  check(inner.sourceCheckFailure === null, "CHECKED_UNCHANGED_SOURCE_REQUIRED");
  deepStrictEqual(inner.artifacts, plan.artifacts.map(({ executable, bytes, sha256 }) => ({ path: executable, executable, bytes, sha256 })));
  deepStrictEqual(inner.testLoopLimits, plan.testLoop);
  const nativeCaptures = "/build/native/_work/gpu-owner-recovery/runs/" + plan.runId;
  for (const [i, attempt] of inner.results.entries()) {
    const result = inner.qualificationResults[i]; passed(attempt, true);
    check(attempt.timeoutMs === plan.testLoop.perTestMs && attempt.captureDirectory === nativeCaptures + "/" + attempt.id, "EXACT_TEST_CAPTURE_AND_BUDGET_REQUIRED");
    deepStrictEqual(attempt.commandResult, { status: "PASS", exitCode: 0, failure: null, stdoutBytes: attempt.stdoutBytes, stderrBytes: attempt.stderrBytes });
    captures(attempt, attempt.captureDirectory);
    check(Array.isArray(result.stdoutSummaries) && result.stdoutSummaries.length === 1 && typeof result.stdoutSummaries[0] === "string"
      && testPassed({ status: result.status, exitCode: result.exitCode, failure: result.failure, stdout: result.stdoutSummaries.join("\n") }, 1), "EXACT_ONE_PASS_ZERO_FAILED_ZERO_IGNORED_REQUIRED");
  }
  const telemetry = inner.telemetry;
  check(telemetry.samples?.length === 2 && telemetry.queries?.length === 2, "TWO_REPORTED_SAMPLES_AND_QUERIES_REQUIRED");
  let clock = 0;
  const guard = makeProgressGuard(plan, () => clock);
  for (const [i, sample] of telemetry.samples.entries()) {
    const query = telemetry.queries[i];
    check(Number.isFinite(sample.queryStartedAtMs) && Number.isFinite(sample.observedAtMs) && sample.observedAtMs >= sample.queryStartedAtMs
      && sample.freeBytes % 1048576 === 0 && sample.totalBytes % 1048576 === 0, "REPORTED_TELEMETRY_SCALARS_REQUIRED");
    clock = sample.queryStartedAtMs; const started = guard.startQuery();
    check(query.id === "telemetry-" + String(i + 1).padStart(4, "0") && query.query === started.query && sample.query === started.query
      && query.queryStartedMs === started.queryStartedAtMs && query.timeoutMs === plan.guard.queryTimeoutMs, "REPORTED_QUERY_SEQUENCE_AND_LIMIT_REQUIRED");
    passed(query, true); deepStrictEqual(query.argv, telemetryArgv(plan));
    check(query.captureDirectory === nativeCaptures + "/" + query.id, "REPORTED_QUERY_CAPTURE_PATH_REQUIRED");
    deepStrictEqual(query.commandResult, { status: "PASS", exitCode: 0, failure: null, stdoutBytes: query.stdoutBytes, stderrBytes: query.stderrBytes });
    captures(query, query.captureDirectory);
    clock = sample.observedAtMs;
    const modeled = guard.accept(`${sample.uuid}, ${sample.freeBytes / 1048576}, ${sample.totalBytes / 1048576}\n`);
    deepStrictEqual(modeled, sample);
  }
  clock = inner.elapsedMs; guard.check();
  const events = telemetry.events;
  check(events.path === "/evidence/inner/events.ndjson" && events.bytes === 1476 && events.attemptedBytes === events.bytes && events.writeFailed === false
    && events.count === 8 && events.lastSequence === events.count && /^[a-f0-9]{64}$/.test(events.sha256), "REPORTED_JOURNAL_METADATA_ONLY_REQUIRED");
  check(report.guardComplete === true && inner.campaignInvocationsConsumed === 1 && inner.remainingCampaignInvocations === 0
    && inner.automaticRetryAuthorized === false && inner.outputBytesPerStreamLimit === 4194304, "REPORTED_COMPLETE_GUARD_AND_CONSUMED_CAMPAIGN_REQUIRED");
  const worker = report.ids.worker;
  check(typeof worker === "string" && /^[a-f0-9]{64}$/.test(worker), "REPORTED_OWNED_CID_REQUIRED");
  const paths = feasibilityPaths(request.operatorRepositoryRoot, plan), ids = ["worker-create", "worker-start", "worker-logs", "worker-state", "worker-remove"];
  const argv = [feasibilityCreate(plan, paths, 1000, 1000), docker(plan, "start", worker), docker(plan, "logs", "--follow", worker),
    docker(plan, "container", "inspect", "--format", "{{json .State}}", worker), docker(plan, "rm", worker)];
  const timeouts = [20000, 20000, 410000, 10000, 15000];
  deepStrictEqual(report.results.map((row: any) => row.id), ids); deepStrictEqual(report.captures.map((row: any) => row.id), ids);
  for (const [i, id] of ids.entries()) {
    const row = report.results[i]; passed(row, false); deepStrictEqual(row.argv, argv[i]);
    check(row.timeoutMs === timeouts[i], "REPORTED_DOCKER_TIMEOUT_REQUIRED");
    deepStrictEqual(row.supervisorResult, { status: "PASS", exitCode: 0, failure: null });
    captures(row, paths.evidence + "/" + id); deepStrictEqual(report.captures[i], { id, streams: row.streams, captureFailures: [] });
  }
  check(report.state.Status === "exited" && report.state.Running === false && report.state.ExitCode === 0 && report.state.OOMKilled === false
    && report.state.Error === "" && report.finalizationSignalObserved === false, "REPORTED_SUCCESSFUL_TERMINAL_STATE_REQUIRED");
  check(Number.isFinite(inner.elapsedMs) && inner.elapsedMs > 0 && Number.isFinite(report.elapsedMs) && inner.elapsedMs <= report.elapsedMs
    && report.elapsedMs < plan.limits.normalOperationsMs, "REPORTED_ELAPSED_WITHIN_NORMAL_BUDGET_REQUIRED");
  check(report.workspace === plan.workspace && report.evidence === plan.evidence && report.retainedInputsReadOnly === true, "REPORTED_APPROVED_WORKSPACE_AND_RO_INPUTS_REQUIRED");
  deepStrictEqual(report.mutableRetainedCaches, []);
  check(report.gpuExecutionAttempted === true && report.testsExecuted === true && report.hostInvocationsConsumed === 1 && report.remainingHostInvocations === 0
    && report.automaticRetryAuthorized === false && report.receiptStatusRequiresZeroHostMarker === true, "REPORTED_GPU_TESTS_AND_CONSUMED_HOST_GRANT_REQUIRED");
  for (const field of ["trainingReady", "canonicalBothQualified", "integratedR4Qualified", "operationalTelemetryQualified", "fullAssuranceQualified", "trainingExecuted"]) {
    check(report[field] === false && inner[field] === false, "FEASIBILITY_IS_NOT_FULL_READINESS_OR_TRAINING:" + field);
  }
  check(report.qualificationImageBuilt === false && report.workspaceIsFilesystemQuota === false && report.dockerWritableLayerIncludedInWorkspaceAccounting === false
    && report.parentDiagnosticsHaveOnlyPostExitSoftSizeCheck === true, "NO_IMAGE_QUOTA_OR_PARENT_STREAMING_ASSURANCE_CLAIM");
}
