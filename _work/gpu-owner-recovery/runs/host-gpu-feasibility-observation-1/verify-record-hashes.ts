// SPEC: _spec/gpu-feasibility.puml
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { gpuSelectors, qualificationPlan, validateLimits } from "../../../../tooling/runtime/qualification";

const root = "_work/gpu-owner-recovery/runs/host-gpu-feasibility-observation-1/";
const sourceRoot = "_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/";
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type HashRow = { path: string; sha256: string; bytes?: number };
async function verifyRows(rows: HashRow[]) {
  for (const row of rows) {
    const bytes = await readFile(row.path);
    assert.equal(sha256(bytes), row.sha256, row.path);
    if (row.bytes !== undefined) assert.equal(bytes.length, row.bytes, row.path);
  }
}

const records = await json(root + "record-check.json"), proof = await json(sourceRoot + "receipt.json");
assert.equal(records.status, "PASS_OPERATOR_REPORTED_GPU_F64_FEASIBILITY_RECORDS_ONLY");
assert.equal(records.sources.length, 12);
assert.equal(proof.sources.length, 327);
await verifyRows(records.sources);
await verifyRows(proof.sources);
const verification = await json(root + "verification.json");
assert.equal(verification.status, "PASS_GPU_FEASIBILITY_OBSERVATION_RECORDS_ONLY");
assert.deepEqual(verification.results.map((row: { id: string }) => row.id), ["records-tests", "records-types", "records-check"]);
let localStreams = 0;
for (const result of verification.results) {
  assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0); assert.equal(result.failure, null);
  assert.equal(result.streams.length, 2);
  await verifyRows(result.streams); localStreams += result.streams.length;
}
const publication = await json(sourceRoot + "publication-result.json");
let publicationStreams = 0;
for (const result of publication.results) {
  assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0); assert.equal(result.failure, null);
  await verifyRows(result.streams); publicationStreams += result.streams.length;
}
const proposal = await json(root + "next-source-planning-proposals.json"), p = proposal.recommended;
assert.equal(proposal.status, "UNSELECTED_FULL_NUMERICAL_C12_SOURCE_PREPARATION_PROPOSALS");
for (const key of ["sourcePreparationSelected", "hostExecutionAuthorized", "copyingOrStagingAuthorized", "gpuExecutionAuthorized", "kernelJitExecutionAuthorized", "publicationAuthorized", "trainingAuthorized", "trainingReady"]) assert.equal(proposal[key], false, key);
assert.deepEqual(p.selectors, [...gpuSelectors]);
const artifacts = new Map([
  ["learning:test:finite_difference", { executable: "/mock/learning", count: 1 }],
  ["policy-io:test:gpu", { executable: "/mock/policy", count: 1 }],
]);
const steps = qualificationPlan("gpu", "full", artifacts);
assert.deepEqual(steps.map(step => step.id), p.selectors);
assert.deepEqual(steps.map(step => step.executable), ["/mock/policy", "/mock/policy", "/mock/learning", "/mock/learning", "/mock/policy", "/mock/policy"]);
validateLimits(p.testLoopLimits, steps.length);
assert.equal(p.testLoopLimits.totalMs, 6 * p.testLoopLimits.perTestMs + p.testLoopLimits.cleanupReserveMs);
assert.equal(p.driverLimits.totalMs, p.driverLimits.preflightMs + p.testLoopLimits.totalMs + p.driverLimits.finalizationMs);
assert.equal(p.hostLimits.overallMs, p.hostLimits.normalOperationsMs + p.hostLimits.cleanupMs + p.hostLimits.receiptReserveMs);
assert.equal(p.maximumNativeCaptureBytes, (p.guard.maximumTelemetryQueries + 6) * 2 * 4 * 1024 * 1024);
assert.equal(p.diskLimits.workspaceAndEvidenceSoftBytes - p.maximumNativeCaptureBytes - p.maximumDockerCaptureBytes, 792 * 1024 * 1024);
const inputs = await Promise.all(["record-check.json", "verification.json", "next-source-planning-proposals.json", "verify-record-hashes.ts"].map(async path => ({ path: root + path, sha256: sha256(await readFile(root + path)) })));
await writeFile(root + "record-hash-closeout.json", JSON.stringify({ status: "PASS_LOCAL_RECORD_HASHES_AND_UNSELECTED_HOST_BOUNDS_PROPOSAL", sources: inputs,
  observationInputHashesChecked: 12, protectedSourceHashesChecked: 327, localVerificationStreamsChecked: localStreams, preservedPublicationStreamsChecked: publicationStreams,
  fullSelectorsChecked: 6, mockExecutableNamesExecuted: false, sourcePreparationSelected: false, hostOperationsPerformed: false,
  originalHostArtifactBytesRehashedInCoding: false, publicationAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_LOCAL_RECORD_HASHES_AND_UNSELECTED_HOST_BOUNDS_PROPOSAL");
