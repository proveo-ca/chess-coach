// SPEC: _spec/runtime-protocol.puml
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { HOST_VOLUME, inspect } from "../preflight";
import type { Counters, MetadataIO } from "../preflight";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const volume = "artifacts/training-functional/campaign-volume-preflight-1", directory = `${volume}/returned-2`;
const handoffPath = `${volume}/handoff.json`, publicationPath = `${volume}/publication-1/post-publication.json`;
const packetPlanPath = "artifacts/training-functional/full-training-packet-1/plan.json";
const priorObservationPath = `${volume}/returned-1/observation.json`;
const publicationCommit = "5b47be42b0378198750992b1547915b43f9cea99";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function read(path: string) { const bytes = readFileSync(resolve(root, path)); assert(bytes.length <= 65536, `INPUT_BOUND:${path}`); return bytes; }
function pin(path: string) { const bytes = read(path); return { path, byteLength: bytes.length, sha256: sha(bytes) }; }
function git(...args: string[]) {
  const result = Bun.spawnSync(["git", "--no-optional-locks", ...args], { cwd: root, env: { PATH: "/usr/local/bin:/usr/bin:/bin", GIT_TERMINAL_PROMPT: "0" },
    stdin: "ignore", stdout: "pipe", stderr: "pipe", timeout: 5000 });
  assert.equal(result.exitCode, 0, "LOCAL_GIT_QUERY"); assert(result.stdout.length <= 65536, "LOCAL_GIT_OUTPUT_BOUND"); return Buffer.from(result.stdout);
}
const bytes = read(`${directory}/user-report.json`); assert(bytes.length <= 8192, "REPORT_BOUND");
const envelope = JSON.parse(bytes.toString("utf8")), handoff = JSON.parse(read(handoffPath).toString("utf8"));
const publication = JSON.parse(read(publicationPath).toString("utf8"));
assert.deepEqual(Object.keys(envelope).sort(), ["planSha256", "publicationCommit", "report", "sourceSha256"]);
assert.equal(envelope.publicationCommit, publicationCommit); assert.equal(git("rev-parse", "HEAD").toString().trim(), publicationCommit);
assert.equal(publication.head, publicationCommit); assert.equal(publication.remote.oid, publicationCommit);
assert.equal(publication.pullRequest.headRefOid, publicationCommit); assert.equal(publication.newScopedConditionalPublicationGrant, "CONSUMED");
const frozenPaths = [handoffPath, packetPlanPath, handoff.source.path, handoff.renderer.path, handoff.packetRequest.path, handoff.packetCompletion.path];
const before = frozenPaths.map(pin), priorPin = pin(priorObservationPath);
for (const path of frozenPaths) assert(read(path).equals(git("cat-file", "blob", `${publicationCommit}:${path}`)), `FROZEN_COMMIT_BYTES:${path}`);
for (const reference of [handoff.source, handoff.renderer, handoff.packetRequest, handoff.packetCompletion]) assert.deepEqual(pin(reference.path), reference);
assert.equal(envelope.sourceSha256, handoff.source.sha256); assert.equal(envelope.planSha256, sha(Buffer.from(JSON.stringify(handoff.plan))));
const report = envelope.report; assert.equal(report.hostPath, HOST_VOLUME); assert.equal(handoff.selectedHostPath, HOST_VOLUME);
assert.equal(report.requestSha256, handoff.packetRequest.sha256); assert.equal(report.requestSha256, handoff.plan.requestSha256);
assert.deepEqual(report.pathMetadata.observed, { kind: "directory", mode: 0o644, uid: "0", gid: "0" });
const counters = {} as Counters;
for (const key of ["type", "bsize", "bavail", "files", "ffree"] as const) {
  const value = report.capacity.raw[key]; assert.equal(typeof value, "string"); assert(/^-?\d{1,20}$/.test(value));
  counters[key] = BigInt(value); assert.equal(String(counters[key]), value);
}
const calls: string[] = [], io: MetadataIO = { now: () => 0, alarm: () => () => {},
  lstat: async path => { calls.push(`lstat:${path}`); assert.equal(path, HOST_VOLUME); return report.pathMetadata.observed; },
  statfs: async path => { calls.push(`statfs:${path}`); assert.equal(path, HOST_VOLUME); return counters; } };
assert.deepEqual(await inspect(io, handoff.plan), report); assert.deepEqual(calls, [`lstat:${HOST_VOLUME}`, `statfs:${HOST_VOLUME}`]);
assert.equal(report.status, "BLOCKED_METADATA_PRECONDITIONS"); assert.deepEqual(report.failures, ["FREE_ENTRIES_UNKNOWN"]);
assert.equal(report.capacity.bytesSufficient, true); assert.equal(report.capacity.freeEntries, null); assert.equal(report.capacity.entriesSufficient, null);
const available = BigInt(report.capacity.usableBytes), required = BigInt(report.thresholds.usableBytes), margin = available - required;
assert.equal(available, 386035548160n); assert.equal(margin, 102567706624n);
assert.equal(counters.type, 0x9123683en); assert.equal(counters.files, 0n); assert.equal(counters.ffree, 0n);
const priorAvailable = BigInt(JSON.parse(read(priorObservationPath).toString("utf8")).admission.reportedAvailableBytes);
assert.equal(priorAvailable, 168244568064n);
assert.deepEqual(frozenPaths.map(pin), before); assert.deepEqual(pin(priorObservationPath), priorPin);
const observation = {
  status: "PASS_LOCAL_INTAKE_VALIDATION_BYTE_ADMISSION_PASSES_ENTRY_CONTRACT_DECISION_PENDING",
  scope: "USER_PASTED_JSON_NOT_RAW_HOST_CAPTURE_OR_INDEPENDENT_ATTESTATION",
  provenance: { origin: "EXPLICIT_USER_REQUESTED_RECHECK_AFTER_REPORTED_HOST_CLEANUP_JSON_SAVED_WITH_FINAL_LF",
    userReport: pin(`${directory}/user-report.json`), source: pin(`${directory}/intake.ts`), publicationCommit,
    publicationReceipt: pin(publicationPath), publicationReceiptIsHistorical: true, currentRemoteQueried: false,
    independentlyCollectedHostFacts: false, priorObservation: priorPin },
  validation: { publishedSourcePlanRequestAndTargetBindingsMatch: true, frozenCommitBytesMatch: true,
    injectedMetadataInterpretationMatchesEntireReport: true, immutablePinsBefore: before, immutablePinsAfter: frozenPaths.map(pin) },
  admission: { status: report.status, failures: report.failures, reportedAvailableBytes: String(available), requiredAvailableBytes: String(required),
    bytesSufficient: true, availableMarginBytes: String(margin), reportedAvailableGiBApprox: (Number(available) / 2 ** 30).toFixed(2),
    requiredAvailableGiB: String(required / 2n ** 30n), availableMarginGiBApprox: (Number(margin) / 2 ** 30).toFixed(2),
    reportedAvailabilityIncreaseBytes: String(available - priorAvailable), freeEntries: null, entriesSufficient: null,
    freeEntriesMeaning: "UNKNOWN_NOT_ZERO", requiredFreeEntries: report.thresholds.freeEntries, entryRuleReplacedOrWaived: false },
  filesystem: { reportedType: String(counters.type), magic: "0x9123683e", mappedName: "BTRFS_SUPER_MAGIC",
    magicReference: "https://raw.githubusercontent.com/torvalds/linux/master/include/uapi/linux/magic.h",
    upstreamStatfsReference: "https://raw.githubusercontent.com/torvalds/linux/master/fs/btrfs/super.c",
    observedUpstreamBtrfsStatfsAssignsFileOrFreeEntryCounters: false, hostKernelVersionVerified: false,
    fixedFreeEntryCapacityProved: false },
  permissions: { reportedOwnerUid: "0", reportedOwnerGid: "0", reportedModeOctal: "0644", directorySearchModeBitsPresent: false,
    effectiveDirectoryUsabilityVerified: false, selinuxCompatibilityVerified: false, permissionsOrLabelsChanged: false },
  nextBoundary: "EXPLICIT_FILESYSTEM_ENTRY_ADMISSION_CONTRACT_DECISION_NOT_REPEATED_IDENTICAL_STATFS_QUERY",
  effects: { hostCommandsExecuted: false, hostPreparationExecuted: false, campaignRootsRelocated: false,
    additionalCleanupAuthorized: false, nativeGpuDockerCommandsExecuted: false, trainingExecuted: false,
    readinessFlagsChanged: false, admissionRulesChanged: false, packetChanged: false, publicationPerformed: false,
    trainingExecutionAuthorized: false }
};
writeFileSync(resolve(root, `${directory}/observation.json`), JSON.stringify(observation, null, 2) + "\n", { flag: "wx" });
console.log("Executor: " + JSON.stringify({ status: observation.status, userReport: observation.provenance.userReport,
  availableGiBApprox: observation.admission.reportedAvailableGiBApprox, marginGiBApprox: observation.admission.availableMarginGiBApprox,
  bytesSufficient: true, entriesSufficient: null, directoryMode: "0644" }));
