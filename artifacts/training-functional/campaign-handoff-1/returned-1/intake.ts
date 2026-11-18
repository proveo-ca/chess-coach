// SPEC: _spec/runtime-protocol.puml
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inspect } from "../preflight";
import type { FrozenPlan, MetadataIO, NodeMetadata } from "../preflight";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const directory = "artifacts/training-functional/campaign-handoff-1/returned-1";
const handoffPath = "artifacts/training-functional/campaign-handoff-1/handoff.json";
const packetPlanPath = "artifacts/training-functional/full-training-packet-1/plan.json";
const publicationPath = "artifacts/training-functional/campaign-handoff-1/publication-1/post-publication.json";
const publicationCommit = "c60a45e1588fabf16c76da7127e160b17147dcf7";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function read(path: string) {
  const bytes = readFileSync(resolve(root, path));
  assert(bytes.length <= 65536, `INPUT_BOUND:${path}`);
  return bytes;
}
function pin(path: string) { const bytes = read(path); return { path, byteLength: bytes.length, sha256: sha(bytes) }; }
function git(...args: string[]) {
  const result = Bun.spawnSync(["git", "--no-optional-locks", ...args], { cwd: root,
    env: { PATH: "/usr/local/bin:/usr/bin:/bin", GIT_TERMINAL_PROMPT: "0" }, stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 5000 });
  assert.equal(result.exitCode, 0, "LOCAL_GIT_QUERY");
  assert(result.stdout.length <= 65536, "LOCAL_GIT_OUTPUT_BOUND");
  return Buffer.from(result.stdout);
}
const bytes = read(`${directory}/user-report.json`);
assert(bytes.length <= 32768, "REPORT_BOUND");
const envelope = JSON.parse(bytes.toString("utf8"));
const handoff = JSON.parse(read(handoffPath).toString("utf8"));
const plan = handoff.plan as FrozenPlan;
const packetPlan = JSON.parse(read(packetPlanPath).toString("utf8")).plan;
const publication = JSON.parse(read(publicationPath).toString("utf8"));
assert.deepEqual(Object.keys(envelope).sort(), ["planSha256", "publicationCommit", "report", "sourceSha256"]);
assert.equal(envelope.publicationCommit, publicationCommit);
assert.equal(git("rev-parse", "HEAD").toString().trim(), publicationCommit);
assert.equal(publication.head, publicationCommit);
assert.equal(publication.remote.oid, publicationCommit);
assert.equal(publication.pullRequest.headRefOid, publicationCommit);
assert.equal(publication.freshConditionalPublicationGrant, "CONSUMED");
const frozenPaths = [handoffPath, packetPlanPath, handoff.source.path, handoff.renderer.path, handoff.packetRequest.path, handoff.packetCompletion.path];
const before = frozenPaths.map(pin);
for (const path of frozenPaths) assert(read(path).equals(git("cat-file", "blob", `${publicationCommit}:${path}`)), `FROZEN_COMMIT_BYTES:${path}`);
for (const reference of [handoff.source, handoff.renderer, handoff.packetRequest, handoff.packetCompletion]) assert.deepEqual(pin(reference.path), reference);
assert.equal(envelope.sourceSha256, handoff.source.sha256);
assert.equal(envelope.planSha256, sha(Buffer.from(JSON.stringify(plan))));
assert.equal(envelope.report.requestSha256, handoff.packetRequest.sha256);
assert.equal(plan.requestSha256, handoff.packetRequest.sha256);
const report = envelope.report;
assert.equal(report.capacity.path, plan.runsParent);
assert.deepEqual(report.thresholds, { usableBytes: plan.minimumUsableBytes, freeEntries: plan.minimumFreeEntries });
assert.equal(report.capacity.usableBytes, "168357556224");
assert.equal(report.capacity.freeEntries, null);
assert.equal(report.capacity.error, null);
assert.deepEqual(report.freshRoots, plan.freshRoots.map(path => ({ path, observation: "ABSENT", error: "ENOENT" })));
assert.equal(report.retained.length, plan.retained.length);
const metadata = new Map<string, NodeMetadata>();
for (const [index, expected] of plan.retained.entries()) {
  const row = report.retained[index];
  assert.equal(row.path, expected.path);
  assert.equal(row.expected, expected.kind);
  assert.equal(row.matches, true);
  assert.equal(row.error, null);
  assert.deepEqual(Object.keys(row.observed).sort(), ["kind", "mode"]);
  assert(Number.isInteger(row.observed.mode) && row.observed.mode >= 0 && row.observed.mode <= 4095);
  metadata.set(row.path, row.observed);
}
const io: MetadataIO = { now: () => 0, alarm: () => () => {},
  statfs: async path => { assert.equal(path, plan.runsParent); return { usableBytes: BigInt(report.capacity.usableBytes), freeEntries: null }; },
  lstat: async path => { if (plan.freshRoots.includes(path)) throw Object.assign(new Error("ABSENT"), { code: "ENOENT" });
    const node = metadata.get(path); assert(node, "INJECTED_METADATA_ALLOWLIST"); return node; } };
assert.deepEqual(await inspect(io, plan), report);
assert.equal(report.status, "BLOCKED_METADATA_PRECONDITIONS");
assert.deepEqual(report.failures, ["USABLE_BYTES_INSUFFICIENT", "FREE_ENTRIES_UNKNOWN"]);
const available = BigInt(report.capacity.usableBytes), required = BigInt(plan.minimumUsableBytes);
assert(Number.isSafeInteger(packetPlan.storageAdmission.requiredUsableBytes));
const conservative = BigInt(packetPlan.storageAdmission.requiredUsableBytes), shortfall = required - available;
assert.equal(shortfall, 115110285312n);
assert.equal(conservative, 191396683776n);
assert(conservative > available);
assert.deepEqual(frozenPaths.map(pin), before);
const observation = {
  status: "PASS_LOCAL_INTAKE_VALIDATION_REPORTED_HOST_STORAGE_BLOCKED",
  scope: "USER_PASTED_METADATA_NOT_RAW_HOST_CAPTURE_OR_INDEPENDENT_ATTESTATION",
  provenance: { origin: "USER_MESSAGE_JSON_SAVED_WITH_FINAL_LF", userReport: pin(`${directory}/user-report.json`),
    source: pin(`${directory}/intake.ts`), publicationCommit, publicationReceipt: pin(publicationPath),
    publicationReceiptIsHistorical: true, currentRemoteQueried: false, independentlyCollectedHostFacts: false },
  validation: { publishedSourcePlanRequestBindingsMatch: true, frozenCommitBytesMatch: true,
    injectedMetadataInterpretationMatchesEntireReport: true, freshRootsReportedAbsent: report.freshRoots.length,
    retainedKindModeChecksReportedMatching: metadata.size, immutablePinsBefore: before, immutablePinsAfter: frozenPaths.map(pin) },
  admission: { status: report.status, failures: report.failures, reportedAvailableBytes: String(available),
    requiredAvailableBytes: String(required), shortfallBytes: String(shortfall),
    reportedAvailableGiBApprox: (Number(available) / 2 ** 30).toFixed(2), requiredAvailableGiB: String(required / 2n ** 30n),
    shortfallGiBApprox: (Number(shortfall) / 2 ** 30).toFixed(2), conservativeStorageBoundBytes: String(conservative),
    conservativeBoundAlsoExceedsReportedAvailability: true, freeEntries: null, freeEntriesMeaning: "UNKNOWN_NOT_ZERO",
    requiredFreeEntries: plan.minimumFreeEntries, filesystemType: "NOT_RECORDED", quotaVerified: false, reservationCreated: false },
  nextBoundary: "EXECUTOR_STORAGE_ROUTE_DECISION_REQUIRED_BEFORE_PLAN_CHANGES_OR_NEW_HOST_VERIFICATION",
  effects: { hostCommandExecuted: false, hostPreparationExecuted: false, nativeGpuDockerCommandsExecuted: false,
    trainingExecuted: false, readinessFlagsChanged: false, admissionRulesChanged: false, packetChanged: false,
    cleanupAuthorized: false, publicationPerformed: false, trainingExecutionAuthorized: false }
};
writeFileSync(resolve(root, `${directory}/observation.json`), JSON.stringify(observation, null, 2) + "\n", { flag: "wx" });
console.log("Executor: " + JSON.stringify({ status: observation.status, source: observation.provenance.userReport,
  shortfallBytes: String(shortfall), shortfallGiBApprox: observation.admission.shortfallGiBApprox, freeEntries: "UNKNOWN_NOT_ZERO" }));
