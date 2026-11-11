// SPEC: _spec/gpu-host-build-reuse.puml
import { deepStrictEqual } from "node:assert";
import { nativeCommands } from "../../qualification/host-build/driver";
import { docker } from "../../qualification/host-build/build";
import { workerCreateReuse } from "../../qualification/host-build-reuse/host";
import { reusePaths, type ReusePlan } from "../../qualification/host-build-reuse/plan";

const check = (value: unknown, reason: string) => { if (!value) throw Error(reason); };
export function validateReportedBuildTwo(report: any, request: any, plan: ReusePlan, summary: string) {
  const lines = summary.trimEnd().split("\n"), frame = JSON.parse(lines[0]!);
  check(lines.length === 2 && lines[1] === "HOST_NATIVE_BUILD_EXIT=0" && frame.status === report.status && frame.failure === null && frame.trainingReady === false && frame.receipt === request.expectedReceipt, "ZERO_MARKER_AND_PASS_FRAME_REQUIRED");
  check(report.version === "chess-coach.owned-container-reused-cache-native-build.v1" && report.status === "PASS_HOST_GPU_NATIVE_BUILD_ONLY" && report.failure === null && report.method === request.acceptedMethod, "REPORTED_BUILD_ONLY_PASS_REQUIRED");
  deepStrictEqual(report.requestedResources, request.resources); deepStrictEqual(report.limits, request.limits);
  deepStrictEqual(report.cleanupFailures, []);
  check(report.workspace === request.workspace && report.evidence === request.evidence && /^[a-f0-9]{64}$/.test(report.ids.worker), "APPROVED_PATHS_AND_REPORTED_OWNED_ID_REQUIRED");
  const native = report.nativeReceipt;
  check(native.status === "PASS_NATIVE_COMPILATION_ONLY" && native.failure === null && native.stage === "complete" && native.bunVersion === "1.4.0" && native.compilationAttempts === 2, "FRESH_BOTH_NATIVE_COMPILATIONS_REQUIRED");
  check(native.sourceChanged === false && native.sourceStabilityChecked === true && native.sourceCheckFailure === null && native.sourceManifestSha256 === request.sourceManifestSha256 && native.previousSourceManifestSha256 === request.previousSourceManifestSha256, "CHECKED_CORRECTED_SOURCE_GENERATION_REQUIRED");
  check(native.retainedCachesWritable === true && native.copiedCargoCache === false && native.staging.bytes === 663642 && native.staging.files === 66 && native.elapsedMs === 16200.1312 && report.elapsedMs === 18384.74729, "REPORTED_REUSE_STAGING_AND_ELAPSED_FACTS");
  const nativeCommandsExpected = nativeCommands();
  check(native.results.length === nativeCommandsExpected.length, "FIVE_NATIVE_RESULTS_REQUIRED");
  for (const [index, command] of nativeCommandsExpected.entries()) {
    const row = native.results[index];
    check(row.id === command.id && row.attempted === true && row.status === "PASS" && row.exitCode === 0 && row.failure === null, "REPORTED_NATIVE_COMMAND_PASS_REQUIRED:" + command.id);
    deepStrictEqual(row.argv, command.argv); deepStrictEqual(row.captureFailures, []); deepStrictEqual(row.canonicalCopyFailures, []);
    check(row.streams.length === 2, "NATIVE_CAPTURE_PAIR_REQUIRED");
    for (const [j, stream] of ["stdout", "stderr"].entries()) {
      const metadata = row.streams[j];
      check(metadata.path === "/build/native/" + request.evidence + "/" + command.id + "/command." + stream && metadata.bytes === row[stream + "Bytes"] && Number.isSafeInteger(metadata.bytes) && metadata.bytes >= 0 && metadata.bytes <= request.limits.supervisedStreamBytes && /^[a-f0-9]{64}$/.test(metadata.sha256), "REPORTED_NATIVE_CAPTURE_METADATA_REQUIRED");
    }
  }
  const paths = reusePaths("/home/gu1lty/Projects/proveo/chess-coach", plan), ids = ["worker-create", "worker-start", "worker-logs", "worker-state", "worker-remove"];
  const argv = [workerCreateReuse(plan, paths, 1000, 1000), docker(plan, "start", report.ids.worker), docker(plan, "logs", "--follow", report.ids.worker), docker(plan, "container", "inspect", "--format", "{{json .State}}", report.ids.worker), docker(plan, "rm", report.ids.worker)];
  deepStrictEqual(report.results.map((row: any) => row.id), ids);
  check(report.captures.length === 5, "FIVE_DOCKER_CAPTURE_PAIRS_REQUIRED");
  for (const [index, id] of ids.entries()) {
    const row = report.results[index], capture = report.captures[index];
    deepStrictEqual(row.argv, argv[index]); deepStrictEqual(row.supervisorResult, { status: "PASS", exitCode: 0, failure: null });
    check(row.status === "PASS" && row.exitCode === 0 && row.failure === null && capture.id === id && capture.streams.length === 2, "REPORTED_OWNED_DOCKER_PASS_REQUIRED");
    for (const [j, stream] of ["stdout", "stderr"].entries()) {
      const metadata = capture.streams[j];
      check(metadata.path === paths.evidence + "/" + id + "/command." + stream && metadata.bytes === row[stream + "Bytes"] && Number.isSafeInteger(metadata.bytes) && metadata.bytes >= 0 && metadata.bytes <= request.limits.supervisedStreamBytes && /^[a-f0-9]{64}$/.test(metadata.sha256), "REPORTED_DOCKER_CAPTURE_METADATA_REQUIRED");
    }
  }
  check(report.state.Status === "exited" && report.state.Running === false && report.state.ExitCode === 0 && report.state.OOMKilled === false && report.finalizationSignalObserved === false, "SUCCESSFUL_REPORTED_TERMINAL_STATE_REQUIRED");
  deepStrictEqual(report.cachePaths, { bun: paths.bun, cargo: paths.cargo, target: paths.target });
  deepStrictEqual(report.mutableCachePaths, [paths.cargo, paths.target]);
  deepStrictEqual(report.cacheWritesScope, { cargoHome: paths.cargo, cargoTarget: paths.target, otherRetainedPathsWritable: false });
  check(report.retainedBunReadOnly === true && report.hostInvocationsConsumed === 1 && report.remainingHostInvocations === 0 && report.automaticRetryAuthorized === false && report.receiptStatusRequiresZeroHostMarker === true, "CONSUMED_GRANT_AND_EXACT_CACHE_SCOPE_REQUIRED");
  for (const field of ["qualificationImageBuilt", "testsExecuted", "gpuExecuted", "trainingReady"]) check(report[field] === false && native[field] === false, "BUILD_PASS_IS_NOT_GPU_OR_TRAINING:" + field);
  check(report.gpuDevicesRequested === false && report.workspaceIsFilesystemQuota === false && report.dockerWritableLayerIncludedInWorkspaceAccounting === false && report.parentDiagnosticsHaveOnlyPostExitSoftSizeCheck === true, "NO_GPU_OR_QUOTA_ASSURANCE_CLAIM");
  const suffixes = ["deps/finite_difference-f3db0ac172c2e4d6", "deps/gpu-1c80603e75bb2c83", "policy-channel", "policy-initialize", "policy-score"];
  const sizes = [154335984, 156637512, 155205160, 151302720, 152001728];
  check(report.artifacts.length === 5, "FIVE_REPORTED_ADMITTED_ARTIFACTS_REQUIRED");
  for (const [index, suffix] of suffixes.entries()) {
    const row = report.artifacts[index], relative = "/x86_64-unknown-linux-gnu/release/" + suffix;
    check(row.executable === "/build/native/target-gpu" + relative && row.path === paths.target + relative && row.bytes === sizes[index] && /^[a-f0-9]{64}$/.test(row.sha256), "REPORTED_ARTIFACT_IDENTITY_REQUIRED");
  }
}
