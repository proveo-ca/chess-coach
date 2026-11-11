// SPEC: _spec/gpu-full-qualification.puml
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const root = "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/", json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Binding = { path: string; sha256: string; bytes?: number };
async function unchanged(row: Binding) { const bytes = await readFile(row.path); assert.equal(hash(bytes), row.sha256, row.path); if (row.bytes !== undefined) assert.equal(bytes.length, row.bytes); }
const approvalPath = root + "host-command-approval.json", approval = await json(approvalPath), request = await json(approval.request.path);
assert.equal(approval.status, "APPROVED_ONE_OPERATOR_HOST_FULL_TWO_INVOCATION_UNCONSUMED_UNOBSERVED");
assert.equal(approval.authorizationSource, "EXECUTOR_SELECTED_APPROVE_HOST_ONLY_RECOMMENDED_FOR_EXACT_SOURCE_FOUR_REQUEST");
assert.equal(approval.executor, "OPERATOR_HOST_ONLY_NEVER_CODING"); assert.equal(approval.runId, "host-gpu-full-2");
assert.equal(approval.request.sha256, "cd8120322c11cd1107a07d1cab883933d1327b1e06ba463d930f23d51a6ab4bf");
for (const row of [approval.request, approval.command, approval.sourceProof, approval.priorConsumptionObservation, ...approval.programs]) await unchanged(row);
for (const key of ["command", "sourceProof", "programs", "resources", "testLoop", "limits", "guard", "retainedReadOnly", "preparedReadOnly", "freshWritableRoots", "scratchGuestAliases", "requestedOperations", "selectedUuid", "guestOrdinal", "maximumHostInvocations", "maximumContainers", "maximumDockerOperations"]) assert.deepEqual(approval[key], request[key], key);
assert.equal(approval.remainingHostInvocations, 1); assert.equal(approval.hostInvocationObserved, false);
assert.equal(approval.anyAttemptConsumesAllowanceIncludingPreflightFailure, true);
for (const key of ["hostExecutionApproved", "gpuExecutionApproved", "runtimeLlvmNvptxCudaKernelJitApproved", "freshEmbeddedTextScratchEvidenceJitWritesApproved", "countHostScratchOnce", "failedFullOneWorkspaceAndEvidenceRetained"]) assert.equal(approval[key], true, key);
for (const key of ["codingHostNativeGpuOrJitExecutionApproved", "manualCommandTextDeliveryApproved", "commandDeliveryOrPublicationAuthorized", "retainedInputCopyingOrMutationApproved", "nativeCompilationApproved", "acquisitionOrInstallationApproved", "automaticRetryAuthorized", "publicationApproved", "experimentTrainingApproved", "trainingReady", "reusePriorWritableJitCache"]) assert.equal(approval[key], false, key);
for (const key of ["priorHostInvocationsRemaining", "priorNormalCommitsRemaining", "priorHttpsPushesRemaining"]) assert.equal(approval[key], 0, key);
assert.equal(approval.deliveryStatus, "LOCAL_UNPUBLISHED_SEPARATE_FRESH_DELIVERY_OR_PUBLICATION_APPROVAL_REQUIRED");
assert.equal(request.status, "AWAITING_FRESH_EXACT_OPERATOR_HOST_APPROVAL");
for (const key of ["hostExecutionApproved", "gpuExecutionApproved", "kernelJitCompilationApproved", "publicationApproved", "commandDeliveryOrPublicationAuthorized", "trainingApproved", "trainingReady"]) assert.equal(request[key], false, key);
const proof = await json(approval.sourceProof.path), baseline = await json("_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json");
assert.equal(proof.status, "PASS_GPU_FULL_SOURCE_ONLY"); assert.equal(proof.sources.length, 347); assert.equal(baseline.sources.length, 327);
for (const row of [...proof.sources, ...baseline.sources]) await unchanged(row);
const consumption = await json(approval.priorConsumptionObservation.path); assert.equal(consumption.remainingHostInvocations, 0); await unchanged(consumption.issuedApproval);
const priorProof = await json("_work/gpu-owner-recovery/runs/host-gpu-full-source-3/receipt.json"), changed: string[] = [];
for (const row of priorProof.sources) if (hash(await readFile(row.path)) !== row.sha256) changed.push(row.path);
assert.deepEqual(changed.sort(), ["driver.test.ts", "driver.ts", "plan.test.ts", "plan.ts"].map(path => "_work/gpu-owner-recovery/qualification/host-full/" + path).sort());
const diagrams = ["gpu-feasibility", "gpu-host-build-reuse", "gpu-host-build", "gpu-host-build-inventory", "gpu-build", "gpu-qualification", "gpu-input-transfer", "gpu-host-receive", "gpu-full-qualification"].map(name => "_spec/" + name + ".puml");
const index = await json("_spec/.spec-index.json");
for (const path of diagrams) {
  const covers = [...(await readFile(path, "utf8")).matchAll(/^' covers: (.+)$/gm)].map(match => match[1]!);
  const entries = index.specs.filter((row: { spec: string }) => row.spec === path); assert.equal(entries.length, 1); assert.deepEqual(entries[0].covers, covers, path);
}
const docPaths = [...diagrams, "_spec/gpu-readiness.md", "_spec/gate-closure.md", "_spec/.spec-index.json"];
const sources = await Promise.all(docPaths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
const inputPaths = [approvalPath, approval.request.path, approval.sourceProof.path, approval.command.path, approval.priorConsumptionObservation.path, root + "review.json", root + "docs-closeout-review.json", root + "post-review-check.json", root + "verify-issued-approval.ts"];
const inputs = await Promise.all(inputPaths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(root + "issued-approval-check.json", JSON.stringify({ status: "PASS_ISSUED_HOST_ONLY_FULL_TWO_APPROVAL_AND_CURRENT_SPEC_BINDINGS_ONLY", sources, inputs,
  orderedDiagramIndexMatches: 9, currentDocHashes: 12, sourceHashesChecked: 347, protectedFeasibilitySources: 327, unchangedPriorInputs: 343,
  remainingHostInvocations: 1, hostInvocationObserved: false, executor: approval.executor, command: approval.command,
  manualCommandTextDeliveryApproved: false, commandDeliveryOrPublicationAuthorized: false, publicationApproved: false,
  codingHostOperationsPerformed: false, actualNativeProcesses: 0, gpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_ISSUED_HOST_ONLY_FULL_TWO_APPROVAL_AND_CURRENT_SPEC_BINDINGS_ONLY");
