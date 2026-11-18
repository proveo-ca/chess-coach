// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CAPS, D, ROOT, R, SOURCE, encoded, equal, exclusive, readRegular, requireThat, sha, validateEligibility } from "../../package-acquisition-bun-source2/capture.ts";
import { validateInvocationReady } from "../invoke-approved-bun.ts";
import { createDeliveryRuntime } from "../delivery-bootstrap.ts";
import { BINDING_PATH, READY_PATH, PACKET_PATH, CURRENT_REVIEWS, byteIdentity, prepareCandidate, repositoryReader } from "../seal-ready-packet.ts";
import { MANIFEST_PATH, RESULT_PATH, RESULT_STATUS, SOURCE_OUTPUT_PATHS } from "../seal-ready-packet-emit.ts";

type Obj = Record<string, unknown>;
const E = `${R}/source-emission-1`, MAX_FILE = 16 * 1024 * 1024;
let totalRead = 0;
function object(value: unknown): Obj {
  requireThat(value !== null && typeof value === "object" && !Array.isArray(value), "postcheck-object"); return value as Obj;
}
function safe(path: string): void {
  requireThat(path.length > 0 && path.length <= 2048 && /^[A-Za-z0-9_./-]+$/.test(path) && path.split("/").every(p => p !== "" && p !== "." && p !== ".."), "postcheck-relative-path");
  requireThat(!path.startsWith("_work/gpu-owner-recovery/cache/") && !path.includes("/continuation-source-1/home/") && !path.split("/").some(p => [".bun", "node_modules", "target", "compiler-output", "full1", "halted-llvm"].includes(p)) && !/\.(?:tgz|gz|xz|zip|zst|crate|bpk|so|o|rlib|rmeta|bc)$/.test(path), "postcheck-no-cache-or-binary");
}
function read(path: string, cap = MAX_FILE): Buffer {
  safe(path); requireThat(Number.isSafeInteger(cap) && cap > 0 && cap <= MAX_FILE, "postcheck-read-cap");
  const bytes = readRegular(join(ROOT, path), cap); totalRead += bytes.length;
  requireThat(totalRead <= 256 * 1024 * 1024, "postcheck-total-read-cap"); return bytes;
}
function json(path: string): Obj { return object(JSON.parse(read(path).toString("utf8")) as unknown); }
function state(path: string): Obj {
  safe(path);
  try {
    const s = fs.lstatSync(join(ROOT, path), { bigint: true });
    return { exists: true, directory: s.isDirectory(), regularFile: s.isFile(), symlink: s.isSymbolicLink(), dev: String(s.dev), ino: String(s.ino), mode: String(s.mode), nlink: String(s.nlink), uid: String(s.uid), gid: String(s.gid), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) };
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false }; throw error; }
}
function absentOperational(path: string): void {
  try { fs.lstatSync(join(ROOT, path)); throw new Error(`postcheck-operational-path-created:${path}`); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
}
function rows(value: unknown, count: number): Obj[] {
  requireThat(Array.isArray(value) && value.length === count, "postcheck-row-count"); return value.map(object);
}
function verifyRows(value: unknown, count: number): void {
  const seen = new Set<string>();
  for (const row of rows(value, count)) {
    requireThat(typeof row["path"] === "string" && typeof row["sha256"] === "string" && /^[a-f0-9]{64}$/.test(row["sha256"]) && !seen.has(row["path"]), "postcheck-source-row");
    seen.add(row["path"]); const bytes = read(row["path"]);
    requireThat(sha(bytes) === row["sha256"] && (!Object.hasOwn(row, "bytes") || bytes.length === row["bytes"]), "postcheck-source-drift");
  }
}

requireThat(import.meta.main && process.cwd() === ROOT && process.versions["bun"] === "1.4.0" && process.execArgv.includes("--no-env-file") && process.execArgv.includes("--no-install"), "postcheck-fixed-bun-context");
const writerExit = read(`${E}/exit-code.txt`, 8).toString("utf8");
const writerStdout = read(`${E}/command.stdout`, CAPS.receipt), writerStderr = read(`${E}/command.stderr`, CAPS.receipt);
requireThat(writerExit === "0\n" && writerStdout.toString("utf8") === `${RESULT_STATUS} ${RESULT_PATH}\n` && writerStderr.length === 0, "postcheck-external-writer-exit-and-streams");
const candidate = await prepareCandidate(repositoryReader, CURRENT_REVIEWS), api = await createDeliveryRuntime();
const data = SOURCE_OUTPUT_PATHS.map((path, index) => {
  const s = state(path); requireThat(s["regularFile"] === true && s["symlink"] === false && s["nlink"] === "1" && (Number(s["mode"]) & 0o777) === 0o600, "postcheck-source-output-mode");
  return read(path, index === 2 ? api.constants.limits.packet : 262144);
});
requireThat(data[0]!.equals(candidate.binding) && data[1]!.equals(candidate.ready) && data[2]!.equals(candidate.packet.bytes), "postcheck-derived-byte-identities");
const manifest = object(JSON.parse(data[3]!.toString("utf8")) as unknown), result = object(JSON.parse(data[4]!.toString("utf8")) as unknown);
const packetPin = { path: PACKET_PATH, ...byteIdentity(data[2]!) };
for (const record of [manifest, result]) {
  requireThat(record["nonAuthorizing"] === true && record["scope"] === "SOURCE_PREPARATION_ONLY_NOT_EXECUTION_AUTHORITY" && record["memberCount"] === 48 && equal(record["packet"], packetPin) && equal(record["table"], candidate.packet.table) && equal(record["inputs"], candidate.inputs), "postcheck-emitted-record-binding");
  requireThat(record["manualAttemptsConsumed"] === 0 && record["innerAttemptsConsumed"] === 0 && record["executionReadinessClaimed"] === false, "postcheck-no-operational-authority");
}
requireThat(result["status"] === RESULT_STATUS && result["externalExit0AndPostcheckRequired"] === true && result["resultWriteDurabilityClaimed"] === false && equal(result["manifest"], { path: MANIFEST_PATH, ...byteIdentity(data[3]!) }), "postcheck-provisional-result-link");
const identity = validateEligibility(repositoryReader), readiness = validateInvocationReady(identity, repositoryReader);
requireThat(equal(identity, candidate.identity) && equal(readiness, candidate.readiness), "postcheck-real-written-eligibility");
const verified = api.validatePacket(data[2]!, candidate.packet.pin, candidate.packet.table);
for (const [path, bytes] of verified.files) requireThat(bytes.equals(repositoryReader(path, 1048576)), "postcheck-all-packet-members-live");
for (const row of candidate.inputs) requireThat(equal({ path: row.path, ...byteIdentity(repositoryReader(row.path, 1048576)) }, row), "postcheck-uncached-input-identity");

const baselinePath = `${SOURCE}/fullverification-9/readchecks-after.json`, baselineBytes = read(baselinePath);
const captureReceipt = json(`${SOURCE}/fullverification-9/receipt.json`);
requireThat(sha(baselineBytes) === captureReceipt["readchecksAfterSha256"], "postcheck-preservation-baseline-pin");
const baseline = object(JSON.parse(baselineBytes.toString("utf8")) as unknown), historical = object(baseline["historical"]);
const historicalHashes = object(historical["hashes"]), historicalMetadata = object(historical["metadata"]);
requireThat(Object.keys(historicalHashes).length === 352 && Object.keys(historicalMetadata).length <= 1024, "postcheck-historical-count");
for (const [path, hash] of Object.entries(historicalHashes)) requireThat(sha(read(path)) === hash, "postcheck-historical-hash");
for (const [path, metadata] of Object.entries(historicalMetadata)) requireThat(equal(state(path), metadata), "postcheck-historical-metadata");
const protectedRecords = object(object(baseline["protected"])["sourceAndProofs"]);
requireThat(Object.keys(protectedRecords).length <= 1024, "postcheck-protected-count-cap");
for (const [path, value] of Object.entries(protectedRecords)) {
  const row = object(value); requireThat(sha(read(path)) === row["sha256"] && equal(state(path), row["metadata"]), "postcheck-protected-source-or-metadata");
}
const W = "_work/gpu-owner-recovery/runs", P = `${W}/host-canonical-r4-source-1`;
verifyRows(JSON.parse(read(`${W}/host-gpu-full-source-4/sources.json`).toString("utf8")) as unknown, 347);
verifyRows(json(`${W}/host-gpu-feasibility-source-4/receipt.json`)["sources"], 327);
const nativePath = `${W}/host-gpu-policy-record-correction-source-2/native-source-manifest.json`, nativeBytes = read(nativePath);
requireThat(sha(nativeBytes) === "7e0aa13c178a77e01526d7fa02189c404c1ce3b44666914665cb9ca63a3521ec", "postcheck-native65-manifest-pin");
verifyRows(JSON.parse(nativeBytes.toString("utf8")) as unknown, 65);
verifyRows(JSON.parse(read(`${P}/verification-4/sources-before.json`).toString("utf8")) as unknown, 92);
verifyRows(JSON.parse(read(`${P}/verification-4/sources-after.json`).toString("utf8")) as unknown, 92);
let inputFiles = 0, inputBytes = 0;
for (const [label, expectedCount] of [["local-inputs-1", 427], ["corpus-inputs-1", 2]] as const) {
  const base = `${D}/${label}`, materialization = json(`${base}/materialization.json`), inputManifestBytes = read(`${base}/input-manifest.json`);
  requireThat(sha(inputManifestBytes) === materialization["inputManifestSha256"], "postcheck-input-manifest-pin");
  const inputManifest = object(JSON.parse(inputManifestBytes.toString("utf8")) as unknown), root = `${base}/inputs/reference`;
  requireThat(inputManifest["sourceRoot"] === root, "postcheck-input-source-root");
  const entries = rows(inputManifest["entries"], expectedCount), entryMap = new Map(entries.map(row => [row["path"], row]));
  requireThat(entryMap.size === expectedCount, "postcheck-unique-input-entries");
  for (const row of rows(materialization["files"], expectedCount)) {
    requireThat(typeof row["path"] === "string", "postcheck-input-relative-path"); safe(row["path"]);
    const bytes = read(`${root}/${row["path"]}`), pin = byteIdentity(bytes), entry = entryMap.get(row["path"]);
    requireThat(entry && bytes.length === row["bytes"] && pin.sha256 === row["sha256"] && pin.gitBlobOid === row["gitBlobOid"] && entry["gitBlobOid"] === row["gitBlobOid"] && (entry["expectedBytes"] ?? entry["bytes"]) === row["bytes"], "postcheck-pinned-input-drift");
    inputFiles++; inputBytes += bytes.length;
  }
}
requireThat(inputFiles === 429 && inputBytes === 4522249, "postcheck-input-totals");
const absent = ["_work/gpu-owner-recovery/cache", "_work/gpu-owner-recovery/runs/reference-package-handoff-2", `${R}/acquisition-execution-1`, `${R}/acquisition-invocation-1`, `${D}/package-inputs-2`];
for (const path of absent) absentOperational(path);
const observation = {
  version: "chess-coach.r2-source-emission-postcheck.v1", status: "PASS_SOURCE_EMISSION_EXIT0_AND_READBACK_ONLY", nonAuthorizing: true,
  sourceScriptSha256: sha(readRegular(fileURLToPath(import.meta.url), 65536)),
  writer: { exitCode: 0, stdout: byteIdentity(writerStdout), stderr: byteIdentity(writerStderr), expectedStatusLineMatched: true },
  outputs: SOURCE_OUTPUT_PATHS.map((path, index) => ({ path, ...byteIdentity(data[index]!) })), packet: packetPin,
  memberCount: verified.files.size, aggregateSourceBytes: verified.aggregateBytes, snapshotDirectories: verified.directories.length,
  currentImplementationVerdictsVerified: 12, pureWrittenBindingAndReadinessValid: true, all48MembersMatchLiveSource: true, uncachedInputIdentitiesMatch: true,
  historicalFilesPreserved: 352, historicalMetadataEntriesPreserved: Object.keys(historicalMetadata).length, protectedSourceAndProofRecordsPreserved: Object.keys(protectedRecords).length,
  frozenSourceBindings: [347, 327, 65], canonicalSourceBindings: 92, inputFilesRehashed: inputFiles, inputBytesRehashed: inputBytes,
  forbiddenOperationalPathsAbsent: absent, rawArchivesOrCachePayloadsRead: false, nativeExecuted: false, networkRequestsPerformed: 0,
  manualOrInnerAttemptsConsumed: 0, publicationPerformed: false, executionReadinessClaimed: false, trainingReady: false,
  postcheckReceiptRequiresMatchingCompletedCommandExit0: true,
};
exclusive(join(ROOT, E, "postcheck.json"), encoded(observation, 262144), 262144);
process.stdout.write(`PASS_SOURCE_EMISSION_EXIT0_AND_READBACK_ONLY ${E}/postcheck.json\n`);
