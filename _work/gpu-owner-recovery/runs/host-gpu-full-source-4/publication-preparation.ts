// SPEC: _spec/gpu-full-qualification.puml
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { runBounded } from "../../verify";

export const root = "_work/gpu-owner-recovery/runs/host-gpu-full-source-4/";
export const parent = "3d35125bdcf27542e6a0ad266a9ed118f9d14658", branch = "feat-ml-adjuntant-ii", destination = "https://github.com/proveo-ca/chess-coach.git";
export const documents = [".spec-index.json", "gate-closure.md", "gpu-build.puml", "gpu-feasibility.puml", "gpu-full-qualification.puml", "gpu-host-build-inventory.puml", "gpu-host-build-reuse.puml", "gpu-host-build.puml", "gpu-host-receive.puml", "gpu-input-transfer.puml", "gpu-qualification.puml", "gpu-readiness.md"].map(path => "_spec/" + path);
export const sourceFiles = ["driver.test.ts", "driver.ts", "plan.test.ts", "plan.ts"].map(path => "_work/gpu-owner-recovery/qualification/host-full/" + path);
const roots = ["host-gpu-full-observation-1", "host-gpu-full-cadence-red-1", "host-gpu-full-cadence-green-1", "host-gpu-full-source-4"].map(name => "_work/gpu-owner-recovery/runs/" + name + "/");
const priorRoot = "_work/gpu-owner-recovery/runs/host-gpu-full-source-3/";
const priorFiles = ["host-command-retry-approval-1.json", "host-command-retry-check-1.json", "host-command-retry-closeout-1.json", "host-command-retry-closeout-verification-1.json", "host-command-retry-docs-review-1.json", "host-command-retry-review-1.json", "verify-retry-closeout-1.ts", "publication-attempt.json", "publication-result.json", "publication-staging.json", "push-attempt.json"].map(name => priorRoot + name);
const priorRoots = ["host-command-retry-closeout-1/", "host-command-retry-closeout-verification-1/", "host-launch-observation-1/", "publication-actions/"].map(name => priorRoot + name);
export const localOnlyFiles = ["publication-envelope.json", "publication-request.json", "publication-preparation-check.json", "publication-preparation-verification.json", "publication-review.json", "publication-approval.json", "publication-staging.json", "publication-attempt.json", "publication-result.json", "push-attempt.json", "publication-post-review-check.json"].map(name => root + name);
export const localOnlyRoots = [root + "publication-preparation-actions/", root + "publication-actions/", root + "publication-post-review/"];
export function localOnly(path: string) { return localOnlyFiles.includes(path) || localOnlyRoots.some(prefix => path.startsWith(prefix)); }
export function allowed(path: string) {
  return /^[A-Za-z0-9_./-]+$/.test(path) && !path.split("/").includes("..")
    && !/(?:^|\/)(?:home|tmp|cache|node_modules|target|target-gpu|dist|scratch)(?:\/|$)/.test(path)
    && /\.(?:json|ts|puml|md|mjs|fish|stdout|stderr|txt|ndjson)$/.test(path)
    && (documents.includes(path) || sourceFiles.includes(path) || roots.some(prefix => path.startsWith(prefix)) || priorFiles.includes(path) || priorRoots.some(prefix => path.startsWith(prefix)));
}
export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
export const blob = (bytes: Uint8Array) => createHash("sha1").update("blob " + bytes.length + "\0").update(bytes).digest("hex");
export function validateText(bytes: Uint8Array) { assert.ok(bytes.length <= 4194304 && !bytes.includes(0)); new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
export const pushArgv = (commit: string) => { assert.match(commit, /^[a-f0-9]{40}$/); return ["git", "push", "--porcelain", "--no-follow-tags", "--recurse-submodules=no", destination, commit + ":refs/heads/" + branch]; };
type Row = { path: string; bytes: number; sha256: string; blob: string; mode: string };
async function row(path: string): Promise<Row> {
  assert.ok(allowed(path)); const metadata = await lstat(path); assert.ok(metadata.isFile() && !metadata.isSymbolicLink() && metadata.size <= 4194304);
  const bytes = await readFile(path); validateText(bytes); return { path, bytes: bytes.length, sha256: sha256(bytes), blob: blob(bytes), mode: metadata.mode & 0o111 ? "100755" : "100644" };
}
const json = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const save = async (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
const binding = async (path: string) => { const bytes = await readFile(path); return { path, bytes: bytes.length, sha256: sha256(bytes) }; };
const lines = (text: string) => text.trimEnd().split("\n").filter(Boolean), sorted = (paths: string[]) => [...new Set(paths)].sort();
async function unchanged(value: { path: string; sha256: string; bytes?: number }) { const bytes = await readFile(value.path); assert.equal(sha256(bytes), value.sha256, value.path); if (value.bytes !== undefined) assert.equal(bytes.length, value.bytes); }
export const readArgv = {
  head: ["git", "rev-parse", "HEAD"], branch: ["git", "symbolic-ref", "-q", "HEAD"], staged: ["git", "diff", "--cached", "--name-only"],
  tracked: ["git", "diff", "--name-only", "HEAD", "--"], untracked: ["git", "ls-files", "--others", "--exclude-standard"],
};
async function prepare() {
  assert.equal((await json(root + "publication-preparation-selection.json")).publicationPreparationSelected, true);
  const issued = await json(root + "issued-post-review-check.json"); assert.equal(issued.status, "PASS_CURRENT_ISSUED_HOST_ONLY_FULL_TWO_DOCS_AND_BINDINGS_ONLY");
  for (const value of issued.sources) await unchanged(value);
  const proof = await json(root + "receipt.json"); for (const value of proof.sources) await unchanged(value);
  const directory = root + "publication-preparation-actions/"; await mkdir(directory); const results: unknown[] = [];
  async function run(id: string, argv: string[]) {
    const step = directory + id; await mkdir(step);
    const result = await runBounded(argv, resolve(step), 30000, { cwd: process.cwd(), environment: { PATH: "/usr/local/bin:/usr/bin:/bin", NO_COLOR: "1", GIT_TERMINAL_PROMPT: "0", GIT_NO_LAZY_FETCH: "1", GIT_NO_REPLACE_OBJECTS: "1" } });
    const streams = await Promise.all(["stdout", "stderr"].map(async name => ({ ...await binding(step + "/command." + name) })));
    results.push({ id, argv, ...result, streams }); assert.equal(result.status, "PASS"); return readFile(step + "/command.stdout", "utf8");
  }
  assert.equal((await run("head", readArgv.head)).trim(), parent); assert.equal((await run("branch", readArgv.branch)).trim(), "refs/heads/" + branch);
  assert.equal((await run("staged", readArgv.staged)).trim(), "");
  const tracked = lines(await run("tracked", readArgv.tracked)); assert.deepEqual(tracked.sort(), [...documents, ...sourceFiles].sort());
  const untracked = lines(await run("untracked", readArgv.untracked));
  const paths = sorted([...tracked, ...untracked.filter(path => allowed(path) && !localOnly(path))]); assert.ok(paths.length <= 1500);
  await run("whitespace", ["git", "diff", "--check", "HEAD", "--", ...tracked]);
  const attributes = await run("attributes", ["git", "--literal-pathspecs", "check-attr", "--all", "--", ...paths]);
  assert.ok(!/^.*: (?:filter|working-tree-encoding|eol): (?!unset$|unspecified$).+$/m.test(attributes));
  const files = await Promise.all(paths.map(row)); assert.ok(files.reduce((sum, value) => sum + value.bytes, 0) <= 33554432);
  const requestPath = root + "publication-request.json", envelopePath = root + "publication-envelope.json";
  await save(requestPath, { version: "chess-coach.gpu-full-source-publication-request.v1", status: "AWAITING_FRESH_ONE_NORMAL_COMMIT_AND_FIXED_HTTPS_PUSH_APPROVAL", parentCommit: parent, branch, destination,
    membership: envelopePath, sourceProof: await binding(root + "receipt.json"), command: await binding(root + "host-command.fish"), hostApproval: await binding(root + "host-command-approval.json"),
    preparationSelection: await binding(root + "publication-preparation-selection.json"), commitArgv: ["git", "commit", "-m", "Fix full-six F64 GPU telemetry cadence handoff"],
    pushArgvTemplate: pushArgv("0".repeat(40)).map(value => value === "0".repeat(40) + ":refs/heads/" + branch ? "<VERIFIED_NEW_COMMIT>:refs/heads/" + branch : value),
    normalCommitInvocationsRequested: 1, fixedHttpsPushInvocationsRequested: 1, gitStagingApproved: false, normalCommitApproved: false, httpsPushApproved: false, publicationApproved: false,
    existingInheritedIdentityAndAuthenticationOnly: true, forceAmendOrHookBypassAuthorized: false, newCredentialsOrTransportChangesAuthorized: false,
    compiledBinariesOrDependencyCachesAuthorized: false, sourceOrNativeCompilationAuthorized: false, codingHostOrGpuExecutionAuthorized: false,
    newOrRenewedHostInvocationsAuthorized: 0, existingOperatorHostInvocationsRemaining: 1, hostInvocationObserved: false, manualCommandTextDeliveryApproved: false,
    automaticRetryAuthorized: false, trainingAuthorized: false, trainingReady: false });
  files.push(await row(requestPath)); files.sort((a, b) => a.path.localeCompare(b.path));
  await save(envelopePath, { status: "FROZEN_SOURCE_FOUR_BOUNDED_TEXT_PUBLICATION_CANDIDATE", parent, branch, destination, request: await binding(requestPath),
    files, members: sorted([...files.map(value => value.path), envelopePath]), totalBoundTextBytes: files.reduce((sum, value) => sum + value.bytes, 0),
    selfReference: "PATH_ONLY_NO_SELF_HASH_OR_FUTURE_COMMIT_ID", localOnlyFiles, localOnlyRoots,
    outsideScopeUntrackedPreserved: untracked.filter(path => !allowed(path)), discoveryResults: results,
    stagingApproved: false, commitApproved: false, pushApproved: false, manualDeliveryApproved: false, remainingOperatorHostInvocations: 1, hostInvocationObserved: false, trainingReady: false });
  await verify();
}
async function verify() {
  const envelopePath = root + "publication-envelope.json", envelope = await json(envelopePath), request = await json(envelope.request.path);
  assert.equal(envelope.status, "FROZEN_SOURCE_FOUR_BOUNDED_TEXT_PUBLICATION_CANDIDATE"); assert.equal(envelope.parent, parent); assert.equal(envelope.branch, branch); assert.equal(envelope.destination, destination);
  await unchanged(envelope.request); assert.equal(request.membership, envelopePath); assert.equal(request.status, "AWAITING_FRESH_ONE_NORMAL_COMMIT_AND_FIXED_HTTPS_PUSH_APPROVAL");
  for (const key of ["gitStagingApproved", "normalCommitApproved", "httpsPushApproved", "publicationApproved", "manualCommandTextDeliveryApproved", "automaticRetryAuthorized", "trainingAuthorized", "trainingReady"]) assert.equal(request[key], false, key);
  assert.deepEqual(envelope.members, sorted([...envelope.files.map((value: Row) => value.path), envelopePath]));
  for (const value of envelope.files) { assert.ok(!localOnly(value.path) || value.path === envelope.request.path); assert.deepEqual(await row(value.path), value); }
  assert.ok(envelope.files.length <= 1501 && envelope.files.reduce((sum: number, value: Row) => sum + value.bytes, 0) <= 33554432);
  for (const value of [request.sourceProof, request.command, request.hostApproval, request.preparationSelection]) await unchanged(value);
  const proof = await json(request.sourceProof.path), baseline = await json("_work/gpu-owner-recovery/runs/host-gpu-feasibility-source-4/receipt.json");
  assert.equal(proof.sources.length, 347); assert.equal(baseline.sources.length, 327); for (const value of [...proof.sources, ...baseline.sources]) await unchanged(value);
  const issued = await json(root + "issued-approval-check.json"); for (const value of [...issued.sources, ...issued.inputs]) await unchanged(value);
  const approval = await json(request.hostApproval.path); assert.equal(approval.remainingHostInvocations, 1); assert.equal(approval.hostInvocationObserved, false); assert.equal(approval.commandDeliveryOrPublicationAuthorized, false);
  await save(root + "publication-preparation-check.json", { status: "PASS_FROZEN_SOURCE_FOUR_PUBLICATION_CANDIDATE_ONLY", envelope: await binding(envelopePath), request: envelope.request,
    members: envelope.members.length, hashedFiles: envelope.files.length, sourceHashesChecked: 347, protectedFeasibilitySources: 327, currentDocHashes: 12,
    localOnlyFiles, localOnlyRoots, remainingOperatorHostInvocations: 1, hostInvocationObserved: false, gitWritesPerformed: 0, networkOperationsPerformed: 0, publicationApproved: false, trainingReady: false });
  console.log(JSON.stringify({ status: "PASS_FROZEN_SOURCE_FOUR_PUBLICATION_CANDIDATE_ONLY", members: envelope.members.length }));
}
if (import.meta.main) {
  assert.equal(Bun.version, "1.4.0"); assert.equal(Bun.argv.length, 3);
  if (Bun.argv[2] === "prepare") await prepare(); else if (Bun.argv[2] === "verify") await verify(); else throw Error("PREPARATION_OR_VERIFICATION_ONLY_NO_PUBLICATION_MODE");
}
