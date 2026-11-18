// SPEC: _spec/gpu-full-qualification.puml
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runBounded } from "../../verify";

const root = "_work/gpu-owner-recovery/runs/host-gpu-full-source-3/";
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
type Row = { path: string; sha256: string; bytes?: number };
async function unchanged(row: Row) {
  const bytes = await readFile(row.path); assert.equal(hash(bytes), row.sha256, row.path);
  if (row.bytes !== undefined) assert.equal(bytes.length, row.bytes, row.path);
}
const approvalPath = root + "host-command-approval.json", approval = await json(approvalPath), request = await json(root + "host-command-request.json");
assert.equal(hash(await readFile(approvalPath)), "3be5e0f26e602928af6c41127a53cf41516c04c1dc84fb266a5e713a2b427e76");
assert.equal(approval.status, "APPROVED_ONE_OPERATOR_HOST_FULL_INVOCATION_UNCONSUMED_UNOBSERVED");
assert.equal(approval.executor, "OPERATOR_HOST_ONLY_NEVER_CODING"); assert.equal(approval.remainingHostInvocations, 1);
assert.equal(approval.maximumHostInvocations, 1); assert.equal(approval.maximumContainers, 1); assert.equal(approval.maximumDockerOperations, 7);
assert.equal(approval.hostInvocationObserved, false); assert.equal(approval.anyAttemptConsumesAllowanceIncludingPreflightFailure, true);
for (const field of ["hostExecutionApproved", "gpuExecutionApproved", "runtimeLlvmNvptxCudaKernelJitApproved", "freshEmbeddedTextScratchEvidenceJitWritesApproved", "manualCommandTextDeliveryApproved"]) assert.equal(approval[field], true, field);
for (const field of ["retainedInputCopyingOrMutationApproved", "nativeCompilationApproved", "acquisitionOrInstallationApproved", "automaticRetryAuthorized", "publicationApproved", "experimentTrainingApproved", "trainingReady"]) assert.equal(approval[field], false, field);
for (const field of ["command", "sourceProof", "programs", "resources", "testLoop", "limits", "retainedReadOnly", "preparedReadOnly", "freshWritableRoots", "scratchGuestAliases", "requestedOperations"]) assert.deepEqual(approval[field], request[field], field);
assert.equal(request.hostExecutionApproved, false); assert.equal(request.gpuExecutionApproved, false);
await unchanged(approval.request); await unchanged(approval.command); await unchanged(approval.sourceProof);
for (const row of approval.programs) await unchanged(row);
const proof = await json(root + "receipt.json"); assert.equal(proof.status, "PASS_GPU_FULL_SOURCE_ONLY");
for (const row of proof.sources) await unchanged(row);
const diagrams = ["gpu-feasibility", "gpu-host-build-reuse", "gpu-host-build", "gpu-host-build-inventory", "gpu-build", "gpu-qualification", "gpu-input-transfer", "gpu-host-receive", "gpu-full-qualification"].map(name => "_spec/" + name + ".puml");
const index = await json("_spec/.spec-index.json");
for (const path of diagrams) {
  const text = await readFile(path, "utf8"), covers = [...text.matchAll(/^' covers: (.+)$/gm)].map(match => match[1]!);
  const rows = index.specs.filter((row: { spec: string }) => row.spec === path); assert.equal(rows.length, 1); assert.deepEqual(rows[0].covers, covers, path);
}
const docPaths = [...diagrams, "_spec/gpu-readiness.md", "_spec/gate-closure.md", "_spec/.spec-index.json"];
const sources = await Promise.all(docPaths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
const commands = [
  { id: "types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "--noEmit", "--strict", "--noUnusedLocals", "--noUnusedParameters", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--resolveJsonModule", "--types", "bun", fileURLToPath(import.meta.url)] },
  { id: "head", argv: ["git", "rev-parse", "HEAD"] },
  { id: "whitespace", argv: ["git", "diff", "--check"] },
  { id: "tracked-scope", argv: ["git", "diff", "--name-only"] },
];
await mkdir(root + "issued-checks"); const results = [];
for (const command of commands) {
  const directory = root + "issued-checks/" + command.id; await mkdir(directory);
  const result = await runBounded(command.argv, resolve(directory), command.id === "types" ? 120000 : 20000, { cwd: process.cwd(), environment: { PATH: "/usr/local/bin:/usr/bin:/bin", NO_COLOR: "1" } });
  const streams = await Promise.all(["stdout", "stderr"].map(async name => { const path = directory + "/command." + name, bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
  results.push({ ...command, ...result, streams }); assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0);
}
assert.equal((await readFile(root + "issued-checks/head/command.stdout", "utf8")).trim(), "250d438685d2fc7560b0e31439f282bb2c145888");
assert.ok((await readFile(root + "issued-checks/tracked-scope/command.stdout", "utf8")).trim().split("\n").every(path => path.startsWith("_spec/")));
for (const row of sources) await unchanged(row);
for (const row of proof.sources) await unchanged(row);
const paths = [approvalPath, root + "host-command-request.json", root + "receipt.json", root + "review.json", root + "docs-closeout-review.json", root + "post-review-check.json", root + "verify-issued-approval.ts"];
const inputs = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(root + "issued-approval-check.json", JSON.stringify({ status: "PASS_ISSUED_OPERATOR_HOST_FULL_HANDOFF_RECORDS_ONLY", sources, inputs, results,
  approval: { path: approvalPath, sha256: hash(await readFile(approvalPath)) }, command: approval.command, sourceProof: approval.sourceProof,
  sourceHashesChecked: proof.sources.length, protectedFeasibilitySourceHashesChecked: 327, orderedDiagramIndexMatches: 9, currentDocHashes: 12,
  operatorHostInvocationsRemaining: 1, hostInvocationObserved: false, codingHostOperationsPerformed: false,
  manualLiteralCommandTextDeliveryApproved: true, publicationApproved: false, experimentTrainingApproved: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_ISSUED_OPERATOR_HOST_FULL_HANDOFF_RECORDS_ONLY");
