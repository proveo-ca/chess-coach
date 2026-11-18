// SPEC: _spec/gpu-input-transfer.puml
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { checkSourceGate } from "../../qualification/transfer/prepare";

const directory = "_work/gpu-owner-recovery/runs/host-feasibility-publication-2";
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const check = (value: boolean, label: string) => { if (!value) throw Error(label); };
const receipt = JSON.parse(await readFile(directory + "/publication.json", "utf8"));
check(receipt.status === "FAIL" && receipt.failedStep === "commit" && receipt.attempts.commit === 1, "COMMIT_ATTEMPT_FAILED");
check(receipt.attempts.push === 0 && receipt.attempts.createRelease === 0 && receipt.attempts.upload === 0 && receipt.commitSucceeded === null, "RETAINED_MUTATION_COUNTS");
const stderr = await readFile(directory + "/publish-04/command.stderr", "utf8");
check(stderr.includes("Author identity unknown") && stderr.includes("fatal: empty ident name"), "CAPTURED_IDENTITY_FAILURE");
const head = Bun.spawnSync(["/usr/bin/git", "rev-parse", "--verify", "HEAD"], { env: { PATH: "/usr/bin:/bin", GIT_NO_LAZY_FETCH: "1" }, stdout: "pipe", stderr: "pipe", timeout: 1000 });
check(head.exitCode === 0, "HEAD_OBSERVATION");
const observedHead = head.stdout.toString().trim();
check(observedHead === "d3bb6bcc6420f50c559ad7260f968578e20cf725", "HEAD_UNCHANGED");
const gate = await checkSourceGate("_work/gpu-owner-recovery/runs/gpu-input-transfer-source-5/receipt.json");
const sources = [];
for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
  const paths = entry.isDirectory() ? [directory + "/" + entry.name + "/command.stdout", directory + "/" + entry.name + "/command.stderr"] : [directory + "/" + entry.name];
  for (const path of paths) { const bytes = await readFile(path); sources.push({ path, bytes: bytes.length, sha256: hash(bytes) }); }
}
const inheritedIdentityFields = Object.fromEntries(["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL"].map(key => [key, typeof process.env[key] === "string" && process.env[key]!.length > 0]));
await writeFile(directory + "/outcome-check.json", JSON.stringify({ version: "chess-coach.https-publication-failure-observation.v1", status: "PASS_RETAINED_FAILURE_RECORD_CHECK_ONLY",
  sources, sourceGate: { path: gate.path, sha256: gate.sha256 }, observedHead, headUnchangedFromLastConfirmedPush: true,
  historicalReceiptCommitOutcome: null, observedNewHeadCommitCreated: false, inheritedIdentityFieldsPresent: inheritedIdentityFields, identityValuesRecorded: false,
  childPublisherForwardsGitIdentityEnvironmentFields: false, freshPublicationAttemptConsumed: true, commitInvocationsConsumed: 1,
  pushInvocations: 0, draftCreationInvocations: 0, uploadInvocations: 0, retryOrConfigurationChangePerformed: false,
  compilationPerformed: false, hostOrGpuExecuted: false, trainingReady: false }, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ status: "PASS_RETAINED_FAILURE_RECORD_CHECK_ONLY", observedHead, inheritedIdentityFieldsPresent: inheritedIdentityFields, push: 0, draft: 0, uploads: 0 }));
