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
type Binding = { path: string; sha256: string; bytes?: number };
async function unchanged(value: Binding) {
  const bytes = await readFile(value.path); assert.equal(hash(bytes), value.sha256, value.path);
  if (value.bytes !== undefined) assert.equal(bytes.length, value.bytes, value.path);
}
const approvalPath = root + "host-command-retry-approval-1.json", approval = await json(approvalPath);
assert.equal(hash(await readFile(approvalPath)), "79e605b7dc999597206d1642260ccf4b098c0de3a7cde65dd84e100b1412fcff");
assert.equal(approval.status, "APPROVED_ONE_OPERATOR_HOST_FULL_RETRY_UNCONSUMED_UNOBSERVED");
assert.equal(approval.explicitFreshRetryApproved, true); assert.equal(approval.executor, "OPERATOR_HOST_ONLY_NEVER_CODING");
assert.equal(approval.maximumHostInvocations, 1); assert.equal(approval.remainingHostInvocations, 1); assert.equal(approval.hostInvocationObserved, false);
for (const key of ["automaticRetryAuthorized", "publicationApproved", "experimentTrainingApproved", "nativeCompilationApproved", "acquisitionOrInstallationApproved", "retainedInputCopyingOrMutationApproved", "trainingReady"]) assert.equal(approval[key], false, key);
await unchanged(approval.priorApproval); await unchanged(approval.priorConsumptionObservation); await unchanged(approval.command); await unchanged(approval.sourceProof);
const prior = await json(approval.priorApproval.path), observation = await json(approval.priorConsumptionObservation.path);
for (const key of ["command", "sourceProof", "resources", "testLoop", "limits", "retainedReadOnly", "preparedReadOnly", "freshWritableRoots", "scratchGuestAliases", "requestedOperations"]) assert.deepEqual(approval[key], prior[key], key);
assert.equal(observation.status, "REPORTED_FISH_FILE_READ_FAILURE_PRIOR_ALLOWANCE_CONSERVATIVELY_CLOSED");
assert.equal(observation.priorHostInvocationsRemaining, 0); assert.equal(observation.reportedApprovedScriptLoaded, false);
assert.equal(observation.qualificationReceiptReceived, false); assert.equal(observation.fullGpuCampaignObserved, false); assert.equal(observation.reportedLauncherExitCode, null);
assert.deepEqual(approval.launchArgv, ["fish", "--no-config", root + "host-command.fish"]);
const review = await json(root + "host-command-retry-review-1.json");
assert.equal(review.adversarial.verdict, "READY_TO_MERGE_YES"); assert.equal(review.security.verdict, "READY_ONE_OPERATOR_HOST_RETRY_ONLY");
assert.deepEqual(review.approval, { path: approvalPath, sha256: hash(await readFile(approvalPath)) });
const proof = await json(approval.sourceProof.path); assert.equal(proof.status, "PASS_GPU_FULL_SOURCE_ONLY"); assert.equal(proof.sources.length, 347);
for (const value of proof.sources) await unchanged(value);
const diagrams = ["gpu-feasibility", "gpu-host-build-reuse", "gpu-host-build", "gpu-host-build-inventory", "gpu-build", "gpu-qualification", "gpu-input-transfer", "gpu-host-receive", "gpu-full-qualification"].map(name => "_spec/" + name + ".puml");
const index = await json("_spec/.spec-index.json");
for (const path of diagrams) {
  const covers = [...(await readFile(path, "utf8")).matchAll(/^' covers: (.+)$/gm)].map(match => match[1]!);
  const matches = index.specs.filter((value: { spec: string }) => value.spec === path); assert.equal(matches.length, 1); assert.deepEqual(matches[0].covers, covers, path);
}
const paths = [...diagrams, "_spec/gpu-readiness.md", "_spec/gate-closure.md", "_spec/.spec-index.json"];
const sources = await Promise.all(paths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
const commands = [
  { id: "types", argv: [process.execPath, "--no-env-file", "--no-install", "node_modules/typescript/lib/_tsc.js", "--noEmit", "--strict", "--noUnusedLocals", "--noUnusedParameters", "--target", "ES2022", "--module", "ESNext", "--moduleResolution", "Bundler", "--resolveJsonModule", "--types", "bun", fileURLToPath(import.meta.url)] },
  { id: "head", argv: ["git", "rev-parse", "HEAD"] },
  { id: "scope", argv: ["git", "diff", "--name-only"] },
  { id: "whitespace", argv: ["git", "diff", "--check", "--", "_spec"] },
];
const directory = root + "host-command-retry-closeout-1/"; await mkdir(directory); const results = [];
for (const command of commands) {
  const step = directory + command.id; await mkdir(step);
  const result = await runBounded(command.argv, resolve(step), command.id === "types" ? 120000 : 20000, { cwd: process.cwd(), environment: { PATH: "/usr/local/bin:/usr/bin:/bin", NO_COLOR: "1" } });
  const streams = await Promise.all(["stdout", "stderr"].map(async name => { const path = step + "/command." + name, bytes = await readFile(path); return { path, bytes: bytes.length, sha256: hash(bytes) }; }));
  results.push({ ...command, ...result, streams }); assert.equal(result.status, "PASS"); assert.equal(result.exitCode, 0);
}
assert.equal((await readFile(directory + "head/command.stdout", "utf8")).trim(), "3d35125bdcf27542e6a0ad266a9ed118f9d14658");
assert.deepEqual((await readFile(directory + "scope/command.stdout", "utf8")).trim().split("\n").sort(), ["_spec/gate-closure.md", "_spec/gpu-full-qualification.puml", "_spec/gpu-readiness.md"]);
for (const value of sources) await unchanged(value);
for (const value of proof.sources) await unchanged(value);
const inputPaths = [approvalPath, root + "host-command-retry-check-1.json", root + "host-command-retry-review-1.json", approval.priorApproval.path, approval.priorConsumptionObservation.path, root + "host-launch-observation-1/operator-report.txt", root + "publication-result.json", root + "verify-retry-closeout-1.ts"];
const inputs = await Promise.all(inputPaths.map(async path => ({ path, sha256: hash(await readFile(path)) })));
await writeFile(root + "host-command-retry-closeout-1.json", JSON.stringify({ status: "PASS_CURRENT_RETRY_AUTHORITY_DOCS_AND_UNCHANGED_PUBLISHED_RUNTIME_ONLY", sources, inputs, results,
  sourceHashesChecked: 347, protectedFeasibilitySourceHashesChecked: 327, orderedDiagramIndexMatches: 9, currentDocHashes: 12,
  approval: { path: approvalPath, sha256: hash(await readFile(approvalPath)) }, command: approval.command, launchArgv: approval.launchArgv,
  priorAllowanceConservativelyClosed: true, freshRetryInvocationObserved: false, newCommitOrPushNeededForRuntime: false,
  codingHostOperationsPerformed: false, publicationAuthorized: false, automaticRetryAuthorized: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log("PASS_CURRENT_RETRY_AUTHORITY_DOCS_AND_UNCHANGED_PUBLISHED_RUNTIME_ONLY");
