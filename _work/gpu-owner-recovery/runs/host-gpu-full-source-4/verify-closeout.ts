// SPEC: _spec/gpu-full-qualification.puml
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBounded } from "../../verify";

type Binding = { path: string; sha256: string; bytes?: number };
type Stage = { status: string; exitCode: number | null; failure: string | null; streams: Binding[] };
const root = "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/", observationRoot = "_work/gpu-owner-recovery/runs/host-gpu-full-observation-1/";
const [label] = Bun.argv.slice(2);
assert.equal(Bun.version, "1.4.0"); assert.equal(Bun.argv.length, 3); assert.match(label ?? "", /^closeout-[1-9][0-9]*$/);
const directory = root + label + "/", json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
async function unchanged(value: Binding) {
  const bytes = await readFile(value.path); assert.equal(hash(bytes), value.sha256, value.path);
  if (value.bytes !== undefined) assert.equal(bytes.length, value.bytes, value.path);
}
const packet = await json(root + "record-check.json"), proof = await json(packet.proof.path), request = await json(root + "host-command-request.json");
await unchanged(packet.proof); assert.equal(proof.status, "PASS_GPU_FULL_SOURCE_ONLY"); assert.equal(proof.sourceChanged, false);
assert.equal(proof.sources.length, 347); assert.equal(proof.protectedBaselineSources, 327);
for (const value of proof.sources) await unchanged(value);
const baseline = await json("_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json");
assert.equal(baseline.sources.length, 327); for (const value of baseline.sources) await unchanged(value);
await unchanged(proof.command); for (const value of proof.programs) await unchanged(value);
assert.deepEqual(packet.command, proof.command); assert.equal(packet.status, "PASS_GPU_FULL_SOURCE_PACKET_RECORDS_ONLY");
assert.deepEqual(packet.counts, { full: { tests: 71, assertions: 688 }, feasibility: { tests: 48, assertions: 322 }, qualification: { tests: 41, assertions: 296 } });
for (const value of packet.mockE2e) await unchanged(value);
const observation = await json(observationRoot + "observation.json"), observedCheck = await json(observationRoot + "record-check.json");
assert.equal(observation.remainingHostInvocations, 0); assert.equal(observation.automaticRetryAuthorized, false);
assert.equal(observation.reportedTestExecutionAttempted, null); assert.equal(observation.reportedTestsExecuted, null);
assert.equal(observedCheck.status, "PASS_OPERATOR_REPORTED_CADENCE_ABORT_AND_SEPARATE_CONSUMPTION_RECORDS_ONLY");
for (const value of observedCheck.sources) await unchanged(value);
await unchanged(observation.issuedApproval);
const issued = await json(observation.issuedApproval.path); assert.equal(issued.remainingHostInvocations, 1); assert.equal(issued.hostInvocationObserved, false);
await unchanged(issued.command); await unchanged(issued.sourceProof); await unchanged(issued.priorApproval); await unchanged(issued.priorConsumptionObservation);
const priorProof = await json(issued.sourceProof.path), delta = await json(root + "source-delta-check.json"), changed: string[] = [];
for (const value of priorProof.sources) if (hash(await readFile(value.path)) !== value.sha256) changed.push(value.path);
const fourFiles = ["driver.test.ts", "driver.ts", "plan.test.ts", "plan.ts"].map(path => "_work/gpu-owner-recovery/qualification/host-full/" + path).sort();
assert.deepEqual(changed.sort(), fourFiles); assert.deepEqual(delta.changed, fourFiles); assert.equal(delta.unchangedPriorInputs, 343);
assert.equal(request.status, "AWAITING_FRESH_EXACT_OPERATOR_HOST_APPROVAL"); assert.equal(request.executor, "OPERATOR_HOST_ONLY_NEVER_CODING");
assert.equal(request.runId, "host-gpu-full-2"); assert.deepEqual(request.command, proof.command); assert.deepEqual(request.sourceProof, packet.proof); assert.deepEqual(request.programs, proof.programs);
for (const key of ["resources", "testLoop", "limits", "guard", "selectedUuid"]) assert.deepEqual(request[key], proof.plan[key], key);
assert.deepEqual(request.retainedReadOnly, proof.plan.retained); assert.deepEqual(request.preparedReadOnly, issued.preparedReadOnly);
assert.deepEqual(request.freshWritableRoots, [proof.plan.workspace, proof.plan.evidence]); assert.deepEqual(request.scratchGuestAliases, issued.scratchGuestAliases);
assert.deepEqual(request.requestedOperations, issued.requestedOperations); assert.equal(request.anyAttemptConsumesOneInvocation, true);
for (const key of ["priorHostInvocationsRemaining", "priorNormalCommitsRemaining", "priorHttpsPushesRemaining"]) assert.equal(request[key], 0, key);
for (const key of ["commandDeliveryOrPublicationAuthorized", "automaticRetryAuthorized", "hostExecutionApproved", "gpuExecutionApproved", "kernelJitCompilationApproved", "publicationApproved", "trainingApproved", "trainingReady", "reusePriorWritableJitCache", "nativeCompilationRequested", "acquisitionOrInstallationRequested", "retainedInputCopyingOrMutationRequested"]) assert.equal(request[key], false, key);
assert.equal(request.deliveryStatus, "LOCAL_UNPUBLISHED_SEPARATE_FRESH_DELIVERY_OR_PUBLICATION_APPROVAL_REQUIRED");
const publication = await json("_work/gpu-owner-recovery/runs/host-gpu-full-source-3/publication-result.json");
assert.equal(publication.status, "PASS_SOURCE_THREE_NORMAL_COMMIT_AND_FIXED_HTTPS_PUSH");
const redRoot = "_work/gpu-owner-recovery/runs/host-gpu-full-cadence-red-1/", greenRoot = "_work/gpu-owner-recovery/runs/host-gpu-full-cadence-green-1/";
const red = await json(redRoot + "receipt.json"), green = await json(greenRoot + "receipt.json"), snapshots = await json(redRoot + "source-snapshots.json");
assert.equal(red.status, "FAIL"); assert.equal(red.exitCode, 1); assert.equal(red.failure, null); assert.equal(green.status, "PASS");
const redText = await readFile(redRoot + "command.stderr", "utf8"); assert.match(redText, /TELEMETRY_QUERY_CADENCE/); assert.match(redText, /3 fail/); assert.match(redText, /1003/);
assert.equal(snapshots.snapshots.length, 3);
for (const [i, value] of snapshots.snapshots.entries()) { await unchanged(value); assert.deepEqual(value.origin, red.inputs[i]); assert.equal(value.sha256, value.origin.sha256); }
const records = await json(root + "records-verification.json"), observedVerification = await json(observationRoot + "verification.json");
const stages: Stage[] = [...proof.results, records, ...observedVerification.results];
let streamHashes = 0;
for (const stage of stages) {
  assert.equal(stage.status, "PASS"); assert.equal(stage.exitCode, 0); assert.equal(stage.failure, null);
  for (const value of stage.streams) { await unchanged(value); streamHashes++; }
}
for (const stage of [red, green]) for (const value of stage.streams) { await unchanged(value); streamHashes++; }
const reviews = await json(root + "review.json");
assert.equal(reviews.adversarial.verdict, "READY_TO_MERGE_YES"); assert.equal(reviews.security.verdict, "READY_TO_MERGE_YES");
for (const value of reviews.inputs) await unchanged(value);
const diagrams = ["gpu-feasibility", "gpu-host-build-reuse", "gpu-host-build", "gpu-host-build-inventory", "gpu-build", "gpu-qualification", "gpu-input-transfer", "gpu-host-receive", "gpu-full-qualification"].map(name => "_spec/" + name + ".puml");
const index = await json("_spec/.spec-index.json");
for (const path of diagrams) {
  const covers = [...(await readFile(path, "utf8")).matchAll(/^' covers: (.+)$/gm)].map(match => match[1]!);
  const matches = index.specs.filter((value: { spec: string }) => value.spec === path); assert.equal(matches.length, 1); assert.deepEqual(matches[0].covers, covers, path);
}
const coverage: string[] = index.specs.find((value: { spec: string }) => value.spec === "_spec/gpu-full-qualification.puml").covers;
for (const name of ["host-gpu-full-observation-1", "host-gpu-full-cadence-red-1", "host-gpu-full-cadence-green-1", "host-gpu-full-source-4"]) assert.ok(coverage.includes("_work/gpu-owner-recovery/runs/" + name + "/**"));
assert.ok(!coverage.some(path => path.includes("/cache/") || /\/host-gpu-full-[12]\//.test(path)));
const paths = [...diagrams, "_spec/gpu-readiness.md", "_spec/gate-closure.md", "_spec/.spec-index.json"];
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
const inputPaths = [packet.proof.path, root + "record-check.json", root + "records-verification.json", root + "source-delta-check.json", root + "approval-proposal.json", root + "host-command-request.json", root + "review.json", observationRoot + "observation.json", observationRoot + "reported-receipt.json", observationRoot + "record-check.json", observationRoot + "verification.json", redRoot + "receipt.json", redRoot + "source-snapshots.json", greenRoot + "receipt.json", observation.issuedApproval.path, "_work/gpu-owner-recovery/runs/host-gpu-full-source-3/publication-result.json", fileURLToPath(import.meta.url)];
const inputs = await Promise.all(inputPaths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
const commands = [
  { id: "types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "--noEmit", "--strict", "--noUnusedLocals", "--noUnusedParameters", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--resolveJsonModule", "--types", "bun", fileURLToPath(import.meta.url)] },
  { id: "head", argv: ["git", "rev-parse", "HEAD"] },
  { id: "scope", argv: ["git", "diff", "--name-only", "HEAD", "--"] },
  { id: "whitespace", argv: ["git", "diff", "--check", "HEAD", "--", ...paths, ...fourFiles] },
];
await mkdir(directory); const results = [];
for (const command of commands) {
  const step = directory + command.id; await mkdir(step);
  const result = await runBounded(command.argv, resolve(step), command.id === "types" ? 120000 : 20000, { cwd: process.cwd(), environment: { PATH: "/usr/local/bin:/usr/bin:/bin", NO_COLOR: "1" } });
  const streams = await Promise.all(["stdout", "stderr"].map(async name => { const path = step + "/command." + name, bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
  results.push({ ...command, ...result, streams }); assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0);
}
assert.equal((await readFile(directory + "head/command.stdout", "utf8")).trim(), "3d35125bdcf27542e6a0ad266a9ed118f9d14658");
const diff = (await readFile(directory + "scope/command.stdout", "utf8")).trim().split("\n");
assert.ok(diff.every(path => [...paths, ...fourFiles].includes(path))); assert.ok(fourFiles.every(path => diff.includes(path)));
for (const value of [...sources, ...inputs, ...proof.sources, ...baseline.sources]) await unchanged(value);
await writeFile(root + label + ".json", JSON.stringify({ status: "PASS_CURRENT_SOURCE_FOUR_DOCS_RECORDS_AND_UNAPPROVED_FULL_TWO_REQUEST_ONLY", sources, inputs, results,
  currentSourceHashesChecked: 347, protectedFeasibilitySourceHashesChecked: 327, unchangedPriorInputs: 343, orderedDiagramIndexMatches: 9, currentDocHashes: 12,
  evidenceStreamHashesChecked: streamHashes, expectedPreFixFailuresPreserved: true, preFixSnapshotHashesChecked: 3, command: proof.command,
  priorRetryConsumed: true, remainingHostInvocations: 0, sourceFourLocalUnpublished: true, hostExecutionAuthorized: false, copyingOrStagingAuthorized: false,
  commandDeliveryOrPublicationAuthorized: false, automaticRetryAuthorized: false, codingHostOperationsPerformed: false, actualNativeProcesses: 0, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_CURRENT_SOURCE_FOUR_DOCS_RECORDS_AND_UNAPPROVED_FULL_TWO_REQUEST_ONLY");
