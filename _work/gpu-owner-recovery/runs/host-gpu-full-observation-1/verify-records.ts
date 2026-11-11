// SPEC: _spec/gpu-full-qualification.puml
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { docker } from "../../qualification/host-build/build";
import { fullCreate } from "../../qualification/host-full/host";
import { fullPaths, type FullPlan } from "../../qualification/host-full/plan";

const root = "_work/gpu-owner-recovery/runs/host-gpu-full-observation-1/", sourceRoot = "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/";
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const observation = await json(root + "observation.json"), report = await json(observation.reportedReceipt), grant = await json(observation.issuedApproval.path);
assert.equal(hash(await readFile(observation.issuedApproval.path)), observation.issuedApproval.sha256);
assert.equal(observation.status, "OPERATOR_REPORTED_FULL_CAMPAIGN_CADENCE_ABORT_RETRY_GRANT_CONSUMED");
assert.equal(observation.reportedHostExitCode, 1); assert.equal(observation.remainingHostInvocations, 0);
assert.equal(report.status, "FAIL_HOST_GPU_FULL_ONLY"); assert.equal(report.failure, "DRIVER_ABORT:Error: TELEMETRY_QUERY_CADENCE");
assert.equal(report.innerReceipt, null); assert.equal(report.guardComplete, false); assert.equal(report.testExecutionAttempted, null); assert.equal(report.testsExecuted, null);
assert.equal(report.hostInvocationsConsumed, 1); assert.equal(report.remainingHostInvocations, 0); assert.equal(report.automaticRetryAuthorized, false);
assert.equal(report.state.Status, "exited"); assert.equal(report.state.Running, false); assert.equal(report.state.ExitCode, 137); assert.equal(report.state.OOMKilled, false);
assert.deepEqual(report.cleanupFailures, []); assert.equal(report.elapsedMs, 9865.080253); assert.equal(report.gpuExecutionAttempted, true);
assert.equal(grant.status, "APPROVED_ONE_OPERATOR_HOST_FULL_RETRY_UNCONSUMED_UNOBSERVED");
assert.equal(grant.remainingHostInvocations, 1); assert.equal(grant.hostInvocationObserved, false);
const proof3 = await json(grant.sourceProof.path), planPath = "_work/gpu-owner-recovery/runs/host-gpu-full-source-3/plan.json";
const plan: FullPlan = await json(planPath), paths = fullPaths(grant.operatorRepositoryRoot, plan), cid = report.ids.worker;
assert.equal(hash(await readFile(grant.sourceProof.path)), grant.sourceProof.sha256);
const planBinding = proof3.programs.find((value: { path: string }) => value.path === planPath);
assert.equal(hash(await readFile(planPath)), planBinding.sha256);
assert.match(cid, /^[a-f0-9]{64}$/); assert.deepEqual(report.requestedResources, plan.resources); assert.deepEqual(report.limits, plan.limits);
const ids = ["worker-create", "worker-start", "worker-logs", "worker-stop", "worker-state", "worker-remove"];
const expected = [fullCreate(plan, paths, 1000, 1000), docker(plan, "start", cid), docker(plan, "logs", "--follow", cid), docker(plan, "stop", "--time=2", cid), docker(plan, "container", "inspect", "--format", "{{json .State}}", cid), docker(plan, "rm", cid)];
assert.deepEqual(report.results.map((value: { id: string }) => value.id), ids);
assert.deepEqual(report.results.map((value: { argv: string[] }) => value.argv), expected);
assert.deepEqual(report.results.map((value: { timeoutMs: number }) => value.timeoutMs), [20000, 20000, 890000, 10000, 10000, 15000]);
for (const result of report.results) {
  assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0); assert.equal(result.failure, null); assert.deepEqual(result.captureFailures, []);
  assert.deepEqual(result.supervisorResult, { status: "PASS", exitCode: 0, failure: null }); assert.equal(result.streams.length, 2);
  for (const [i, name] of ["stdout", "stderr"].entries()) {
    const stream = result.streams[i]; assert.equal(stream.path, paths.evidence + "/" + result.id + "/command." + name);
    assert.equal(stream.bytes, result[name + "Bytes"]); assert.ok(Number.isSafeInteger(stream.bytes) && stream.bytes >= 0 && stream.bytes <= 4194304);
    assert.match(stream.sha256, /^[a-f0-9]{64}$/); if (stream.bytes === 0) assert.equal(stream.sha256, hash(Buffer.alloc(0)));
  }
}
assert.deepEqual(report.captures, report.results.map((value: { id: string; streams: unknown }) => ({ id: value.id, streams: value.streams, captureFailures: [] })));
assert.equal(report.workspace, plan.workspace); assert.equal(report.evidence, plan.evidence); assert.equal(report.retainedInputsReadOnly, true); assert.deepEqual(report.mutableRetainedCaches, []);
for (const key of ["trainingReady", "qualificationImageBuilt", "fullAssuranceQualified", "operationalTelemetryQualified", "trainingExecuted", "canonicalBothQualified", "integratedR4Qualified"]) assert.equal(report[key], false, key);
const summary = (await readFile(root + "operator-summary.txt", "utf8")).trimEnd().split("\n"); assert.equal(summary.length, 2); assert.equal(summary[1], "HOST_GPU_FULL_EXIT=1");
assert.deepEqual(JSON.parse(summary[0]!), { status: report.status, failure: report.failure, receipt: plan.evidence + "/receipt.json", trainingReady: false });
const allowedChanges = ["driver.ts", "driver.test.ts", "plan.ts", "plan.test.ts"].map(path => "_work/gpu-owner-recovery/qualification/host-full/" + path).sort();
const changed: string[] = [];
for (const value of proof3.sources) if (hash(await readFile(value.path)) !== value.sha256) changed.push(value.path);
assert.deepEqual(changed.sort(), allowedChanges);
const proof4 = await json(sourceRoot + "receipt.json"); assert.equal(proof4.status, "PASS_GPU_FULL_SOURCE_ONLY");
for (const value of proof4.sources) assert.equal(hash(await readFile(value.path)), value.sha256, value.path);
const inputs = await Promise.all([root + "operator-summary.txt", root + "reported-receipt.json", root + "observation.json", root + "verify-records.ts", observation.issuedApproval.path, grant.sourceProof.path, planPath].map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(root + "record-check.json", JSON.stringify({ status: "PASS_OPERATOR_REPORTED_CADENCE_ABORT_AND_SEPARATE_CONSUMPTION_RECORDS_ONLY", sources: inputs,
  reportedCompleteDockerArgvChecked: 6, reportedCaptureMetadataRows: 24, reportedUniqueCapturePaths: 12, reportedContainerExitCode: 137, reportedOwnedCleanupPassed: true,
  innerReceiptReceived: false, perTestResultsReceived: false, telemetrySamplesOrJournalBytesReceived: false, testExecutionAttempted: null, testsExecuted: null,
  originalHostFilesReceived: false, remainingHostInvocations: 0, newHostOrGpuExecutionAuthorized: false, newPublicationAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
await writeFile(sourceRoot + "source-delta-check.json", JSON.stringify({ status: "PASS_SCOPED_FOUR_FILE_CADENCE_AND_FRESH_IDENTITY_CORRECTION_ONLY", priorProof: { path: grant.sourceProof.path, sha256: grant.sourceProof.sha256 }, changed,
  unchangedPriorInputs: proof3.sources.length - changed.length, currentSourceHashesChecked: proof4.sources.length, protectedFeasibilitySources: 327,
  guardUnchanged: true, numericalAndNativeInputsUnchanged: true, priorProofsRequestsCommandsAndFailedCapturesRetained: true,
  newRunId: proof4.plan.runId, newWorkspace: proof4.plan.workspace, newEvidence: proof4.plan.evidence,
  hostExecutionAuthorized: false, copyingOrStagingAuthorized: false, publicationAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_OPERATOR_REPORTED_CADENCE_ABORT_AND_FOUR_FILE_SOURCE_DELTA_ONLY");
