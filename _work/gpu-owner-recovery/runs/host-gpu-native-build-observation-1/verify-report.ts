// SPEC: _spec/gpu-host-build.puml
import { deepStrictEqual } from "node:assert";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { docker, workerCreate } from "../../qualification/host-build/build";
import { nativeCommands } from "../../qualification/host-build/driver";
import plan from "../../qualification/host-build/plan.json";

const root = "_work/gpu-owner-recovery/runs/host-gpu-native-build-observation-1/";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: unknown, reason: string) => { if (!value) throw Error(reason); };
const report = JSON.parse(await readFile(root + "reported-receipt.json", "utf8"));
const observation = JSON.parse(await readFile(root + "observation.json", "utf8"));
const request = JSON.parse(await readFile(observation.request, "utf8"));
const summary = (await readFile(root + "operator-summary.txt", "utf8")).trimEnd().split("\n"), frame = JSON.parse(summary[0]!);
check(summary.length === 2 && summary[1] === "HOST_NATIVE_BUILD_EXIT=1" && frame.status === report.status && frame.failure === report.failure && frame.receipt === request.expectedReceipt && frame.trainingReady === false, "REPORTED_FAILURE_FRAMES");
check(report.status === "FAIL_HOST_GPU_NATIVE_BUILD_ONLY" && report.failure === "SUCCESSFUL_NATIVE_COMPILATION_RECEIPT_REQUIRED" && report.version === "chess-coach.owned-container-native-build.v1", "OUTER_REPORTED_REJECTION");
deepStrictEqual(report.requestedResources, request.resources); deepStrictEqual(report.limits, request.limits);
check(report.method === request.acceptedMethod && report.workspace === request.workspace && report.evidence === request.evidence, "REPORTED_APPROVED_BUILD_METHOD_AND_PATHS");
const native = report.nativeReceipt;
check(native.status === "FAIL_NATIVE_COMPILATION_ONLY" && native.failure === "NATIVE_COMMAND_FAILED:gpu-policy" && native.stage === "compilation" && native.bunVersion === "1.4.0", "INNER_POLICY_COMPILATION_FAILED");
check(native.compilationAttempts === 2 && native.results.length === 5 && native.staging.bytes === 99444545 && native.staging.files === 1253, "REPORTED_NATIVE_ATTEMPTS_AND_STAGING");
const expected = [
  [36, "f4d034f5660bb49f22bfcba3f3445be67e25b704c193ff421b53863b4faee148", 0, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  [36, "c10ec31b8c6e6e2693cf65fc1971b41edbc3da1ae7db6f9f3f36c4823f8dcab5", 0, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  [7, "105cea6ab21beabd59f0ce9c72349435c99d6012981875d22aae70494f10dc10", 0, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  [320088, "98b9d5d9b6ad214e3b5f780e94885c82be2879d3ef82167e328597fe783c02d5", 9176, "b5f39c51b6cb62256ebb5ebfb06746ed96788189219e251c96e57ad3cfd0a63d"],
  [334214, "28819440f6b1ef9b57a061d80197274dd92853649bc1b1fbecb7fce724683ff1", 1919, "af41c7f5a3f964c289f6ce2a6dc3489e7fc481bab06beaf00be524844c20ab4a"],
];
const commands = nativeCommands();
for (let i = 0; i < commands.length; i++) {
  const result = native.results[i], command = commands[i]!;
  check(result.id === command.id && result.attempted === true && result.status === (i === 4 ? "FAIL" : "PASS") && result.exitCode === (i === 4 ? 101 : 0) && result.failure === null, "REPORTED_COMMAND_OUTCOME:" + command.id);
  deepStrictEqual(result.argv, command.argv); deepStrictEqual(result.captureFailures, []); deepStrictEqual(result.canonicalCopyFailures, []);
  check(result.streams.length === 2, "TWO_NATIVE_CAPTURE_ROWS");
  for (const [j, stream] of ["stdout", "stderr"].entries()) {
    const metadata = result.streams[j];
    check(metadata.path === "/build/native/_work/gpu-owner-recovery/runs/host-gpu-native-build-1/" + command.id + "/command." + stream && metadata.bytes === result[stream + "Bytes"] && metadata.bytes === expected[i]![j * 2] && metadata.sha256 === expected[i]![j * 2 + 1], "REPORTED_NATIVE_CAPTURE_METADATA:" + command.id + ":" + stream);
  }
}
check(native.sourceChanged === false && native.sourceStabilityChecked === true && native.sourceCheckFailure === null && native.sourceManifestSha256 === "9141aaefa2fab3f3a812aeabec4bdfdd818415333f9e5cba6d5ef822dac90863", "REPORTED_CHECKED_SOURCE_STABILITY");
check(native.elapsedMs === 921820.616072 && report.elapsedMs === 923501.887534, "REPORTED_ELAPSED_TIME");
const dockerIds = ["donor-create", "bun-copy", "worker-create", "worker-start", "worker-logs", "worker-stop", "worker-state", "worker-remove", "donor-remove"];
const hostRoot = "/home/gu1lty/Projects/proveo/chess-coach/";
const paths = { context: hostRoot + request.context, workspace: hostRoot + request.workspace, evidence: hostRoot + request.evidence,
  native: hostRoot + request.workspace + "/native", cargo: hostRoot + request.workspace + "/cargo-home", bun: hostRoot + request.workspace + "/bun" };
deepStrictEqual(report.ids, { donor: "5e7216ed81ae3a3aa6ffb0a939cf742e21ea1adfbd5e4d73127da49cfa676298", worker: "87035b2cfd0fba509359d7ea76fc298b8c586ada9e96d118115daacceb7dd2c1" });
deepStrictEqual(request.maximums, plan.maximums); deepStrictEqual(request.resources, plan.resources); deepStrictEqual(request.limits, plan.limits);
const dockerArgv = [
  docker(plan, "create", "--pull=never", "--platform=linux/amd64", "--network=none", "--cidfile=" + paths.evidence + "/donor.cid", "--label=chess-coach.native-build=" + plan.runId, plan.bunImage),
  docker(plan, "cp", "-L", report.ids.donor + ":/usr/local/bin/bun", paths.bun),
  workerCreate(plan, paths, 1000, 1000),
  docker(plan, "start", report.ids.worker),
  docker(plan, "logs", "--follow", report.ids.worker),
  docker(plan, "stop", "--time=10", report.ids.worker),
  docker(plan, "container", "inspect", "--format", "{{json .State}}", report.ids.worker),
  docker(plan, "rm", report.ids.worker),
  docker(plan, "rm", report.ids.donor),
];
deepStrictEqual(report.results.map((result: { id: string }) => result.id), dockerIds);
check(report.captures.length === 9 && report.cleanupFailures.length === 0 && report.artifacts.length === 0, "NINE_DOCKER_CAPTURES_CLEANUP_NO_ADMISSION");
for (const [i, id] of dockerIds.entries()) {
  const result = report.results[i], capture = report.captures[i];
  check(result.status === "PASS" && result.exitCode === 0 && result.failure === null && capture.id === id && capture.streams.length === 2, "REPORTED_DOCKER_OPERATION:" + id);
  deepStrictEqual(result.supervisorResult, { status: "PASS", exitCode: 0, failure: null });
  deepStrictEqual(result.argv, dockerArgv[i]);
  for (const [j, stream] of ["stdout", "stderr"].entries()) {
    const metadata = capture.streams[j];
    check(metadata.path === "/home/gu1lty/Projects/proveo/chess-coach/" + request.evidence + "/" + id + "/command." + stream && metadata.bytes === result[stream + "Bytes"] && /^[a-f0-9]{64}$/.test(metadata.sha256), "REPORTED_DOCKER_CAPTURE_METADATA");
  }
}
deepStrictEqual(report.results[7].argv.slice(2), ["rm", report.ids.worker]); deepStrictEqual(report.results[8].argv.slice(2), ["rm", report.ids.donor]);
check(report.state.Running === false && report.state.ExitCode === 1 && report.state.OOMKilled === false && report.finalizationSignalObserved === false, "REPORTED_TERMINAL_STATE_NOT_COMPILER_DIAGNOSIS");
for (const field of ["qualificationImageBuilt", "testsExecuted", "gpuExecuted", "trainingReady"]) check(report[field] === false && native[field] === false, "NO_TEST_GPU_TRAINING_OR_IMAGE_EVIDENCE:" + field);
check(report.gpuDevicesRequested === false && report.automaticRetryAuthorized === false && report.hostInvocationsConsumed === 1 && report.remainingHostInvocations === 0, "CONSUMED_ONE_SHOT_GRANT");
check(observation.status === "OPERATOR_REPORTED_FAIL_HOST_GPU_NATIVE_BUILD_ONLY" && observation.provenance === "SEMANTICALLY_NORMALIZED_COMPLETE_OPERATOR_JSON_AND_SUMMARY_NOT_ORIGINAL_HOST_BYTES" && observation.reportedHostExitCode === 1 && observation.reportedHostInvocationsConsumed === 1 && observation.remainingHostInvocations === 0, "CURRENT_OBSERVATION_SCOPE");
for (const field of ["originalHostFilesReceived", "actualOperatorCommandBytesIndependentlyVerified", "compilerDiagnosticContentsReceived", "newHostReadsAuthorized", "automaticRetryAuthorized", "newStagingOrBuildAuthorized", "newPublicationAuthorized", "gpuExecutionAuthorized", "trainingAuthorized", "trainingReady"]) check(observation[field] === false, "NO_NEW_AUTHORITY_OR_DIAGNOSTICS:" + field);
check(observation.compilerFailureCause === null && observation.reportedArtifactAdmissionReached === false && observation.partialHostWorkspaceAndCacheRetentionRequired === true && observation.reportedHostNativeCompilationPerformed === true && observation.reportedLearningCompilationPassed === true && observation.reportedPolicyCompilationPassed === false && observation.reportedSourceStabilityChecked === true && observation.reportedSourceChanged === false && observation.reportedOwnedContainerCleanupPassed === true, "PARTIAL_SUCCESS_WITHOUT_OVERALL_PASS");
deepStrictEqual(observation.hostPolicyDiagnosticsRequested, ["stderr", "stdout"].map(stream => request.evidence + "/native/gpu-policy/command." + stream));
check(hash(await readFile(request.sourceProof.path)) === request.sourceProof.sha256 && hash(await readFile(request.command.path)) === request.command.sha256, "UNCHANGED_ORIGINAL_SOURCE_PROOF_AND_COMMAND");
const sourcePaths = [root + "reported-receipt.json", root + "operator-summary.txt", root + "observation.json", root + "verify-report.ts", observation.request, request.sourceProof.path, request.command.path];
const sources = await Promise.all(sourcePaths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(root + "record-check-2.json", JSON.stringify({ status: "PASS_OPERATOR_REPORTED_FAILED_NATIVE_BUILD_RECORDS_ONLY", sources, supersedes: root + "record-check.json", historicalCheckScope: "PRE_REVIEW_CHECKER_SOURCE_CHANGED_NOT_CURRENT_ACCEPTANCE", exactDockerArgvChecked: 9, reportedNativeCommands: 5, reportedDockerOperations: 9, reportedCaptureMetadataRows: 28,
  reportedHostBuildStatus: report.status, reportedHostExitCode: 1, reportedLearningCompilationPassed: true, reportedPolicyCompilationExit: 101, reportedCleanupFailures: 0, reportedArtifactsAdmitted: 0,
  hostInvocationsRemaining: 0, originalHostArtifactBytesRehashed: false, compilerDiagnosticContentsReceived: false, compilerFailureCauseEstablished: false,
  codingHostDockerOrNativeOperationsPerformed: false, newHostReadOrBuildAuthorized: false, newPublicationAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_OPERATOR_REPORTED_FAILED_NATIVE_BUILD_RECORDS_ONLY: policy exit 101; learning exit 0; grant consumed; compiler cause unknown");
