// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = "/home/gu1lty/Projects/proveo/chess-coach";
const d = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1";
const r = `${d}/package-acquisition-proposal-1`, source = `${d}/package-acquisition-bun-source1`;
const output = `${r}/acquisition-result-check-1`;
type Binding = { path: string; bytes: number; sha256: string };
function requireValue(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function data(path: string): Buffer {
  requireValue(!path.startsWith("/") && !path.split("/").some(part => ["..", "cache", ".bun"].includes(part)) && !/\.(?:tgz|tar|gz|xz|zip|bpk)$/.test(path), "record-or-source-only");
  const info = lstatSync(join(root, path));
  requireValue(info.isFile() && !info.isSymbolicLink() && info.size <= 16 * 1024 * 1024, "bounded-regular");
  return readFileSync(join(root, path));
}
function sha(bytes: Buffer): string { return createHash("sha256").update(bytes).digest("hex"); }
function binding(path: string): Binding { const bytes = data(path); return { path, bytes: bytes.length, sha256: sha(bytes) }; }
function json(path: string): any { return JSON.parse(data(path).toString("utf8")); }
function absent(path: string): void {
  try { lstatSync(join(root, path)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
  throw new Error(`unexpected-postfailure-root:${path}`);
}
requireValue(process.cwd() === root && process.execPath === "/usr/local/bin/bun" && Bun.version === "1.4.0", "pinned-proof-runtime");
const result = json(`${r}/acquisition-result1.json`);
const consumption = json(`${r}/acquisition-execution-1/consumption-receipt.json`);
const marker = json(`${r}/acquisition-execution-1/attempt.json`);
const observation = json(`${r}/acquisition-invocation-1/observation.json`);
const approval = json(`${r}/approval1.json`);
const rows: Binding[] = result.evidence;
requireValue(rows.length === 6, "six-original-evidence-files");
for (const row of rows) requireValue(JSON.stringify(binding(row.path)) === JSON.stringify(row), `evidence-drift:${row.path}`);
const events = data(`${r}/acquisition-execution-1/events.jsonl`).toString("utf8").trim().split("\n").map(line => JSON.parse(line));
requireValue(result.status === "FAIL_COMBINED_ATTEMPT_CONSUMED_BEFORE_NETWORK" && observation.assessment === "FAIL" && consumption.terminalState === "FAIL", "failure-scopes");
requireValue(marker.attemptId === result.attemptId && consumption.attemptId === result.attemptId && marker.grantId === result.grantId, "attempt-identity");
requireValue(marker.combinedAttemptsConsumed === 1 && marker.remainingCombinedAttempts === 0 && consumption.combinedAttemptsConsumed === 1 && consumption.remainingCombinedAttempts === 0 && result.remainingAuthorizedCombinedAttempts === 0, "combined-attempt-consumed");
requireValue(consumption.urlStartsConsumed === 0 && consumption.confirmedGetInvocations === 0 && consumption.actualGetRequests === 0 && consumption.responsesCompleted === 0 && result.actualGetRequests === 0, "no-network-start");
requireValue(consumption.workerNotStarted === true && consumption.workerPid === 0 && consumption.workerExitCode === null && consumption.selectedHashesAndMembershipVerified === false, "worker-not-started");
requireValue(consumption.failure === result.failure && result.failure.includes(`lstat '${root}/_work/gpu-owner-recovery/cache'`), "destination-preflight-failure");
requireValue(observation.runner.status === "FAIL" && observation.runner.exitCode === 1 && observation.runner.stdoutBytes === 0 && observation.runner.stderrBytes === 0 && observation.outerWitness.timedOut === false, "invocation-failed-not-timeout");
requireValue(observation.receiptSha256 === binding(`${r}/acquisition-execution-1/consumption-receipt.json`).sha256 && observation.automaticRetryAuthorized === false && observation.retriesPerformed === 0, "receipt-binding-no-retry");
requireValue(events.length === 2 && events[0].type === "COMBINED_CLAIMED" && events[1].type === "TERMINAL_CANDIDATE" && events[1].terminalState === "FAIL", "journal-no-url-start");
requireValue(approval.remainingCombinedAttemptsAtIssuance === 1 && approval.remainingGetRequestsAtIssuance === 2 && approval.immutableIssuanceSnapshotNotLiveConsumptionState === true && binding(`${r}/approval1.json`).sha256 === "62af17fc6199b5537c3488c10680b9269baf170a05a322facfdfad3737fea945", "immutable-issued-approval");
requireValue(result.unusedUrlSlotsAtFailure === 2 && result.unusedUrlSlotsRemainIndependentlyReusable === false && result.remainingAuthorizedGetRequests === 0 && result.automaticRetryAuthorized === false, "unused-url-slots-not-reusable");
for (const path of result.absentAtOutcomeCheck as string[]) absent(path);
const preservedSources: Binding[] = [];
for (const [name, expected] of Object.entries(json(`${source}/verification-10/source-manifest.json`).sourceHashes)) {
  const row = binding(`${source}/${name}`); requireValue(row.sha256 === expected, "capture-source-drift"); preservedSources.push(row);
}
for (const group of Object.values(json(`${r}/invocation-verification-4/receipt.json`).hashes as Record<string, Record<string, string>>)) {
  for (const [path, expected] of Object.entries(group)) { const row = binding(path); requireValue(row.sha256 === expected, "caller-observer-source-drift"); preservedSources.push(row); }
}
const inputs = [binding(`${output}/proof.ts`), binding(`${r}/acquisition-result1.json`), binding(`${r}/approval1.json`), ...rows, ...preservedSources];
writeFileSync(join(root, output, "source-manifest.json"), JSON.stringify(inputs, null, 2) + "\n", { flag: "wx" });
const receipt = { status: "PASS_FAILURE_AND_CONSUMPTION_RECORDS_ONLY", combinedAttemptsConsumed: 1, actualGetRequests: 0, unusedUrlSlotsReusable: false, issuedApprovalUnchanged: true, originalEvidenceFilesRehashed: rows.length, captureCallerObserverSourcesUnchanged: true, productionFailureRepaired: false, retryOrNewAcquisitionInvoked: false, archiveOrCachePayloadRead: false, nativeHostGpuReferenceOrTrainingExecuted: false, gitMutationOrPublicationPerformed: false, trainingReady: false };
writeFileSync(join(root, output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(receipt));
