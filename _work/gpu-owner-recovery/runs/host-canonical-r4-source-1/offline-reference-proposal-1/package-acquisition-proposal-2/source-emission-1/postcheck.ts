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
const REPORT_PATH = `${E}/postcheck-2.json`;
const INPUT_PINS = Object.freeze({
  "local-inputs-1": { manifest: "bb03f45257fae1d8ca11710b53547936c3042380188ab10117b704b692d39fb0", materialization: "2b13f0daad567013823ea2859a0107818ee9b09766347c2190ec3dfe47949506", acceptancePath: `${D}/local-inputs-1/check.json`, acceptance: "acca1e84beb0ebfacf3fb0a7967ffe5d16552861b0da98a4f7e6b4367cee9c63", sourceRows: "eeef9552914021a71018ffbd6f81a0c8b2afc56926ae45efd28dd5c0cfcf5bf7" },
  "corpus-inputs-1": { manifest: "25c53eae03508b523fc36a962984c4aad23a0f0784b6c71123ac6e320f335460", materialization: "b95bbe9c1568d8169c91d6ce3cb174afceab37ab65f973f66fbc62bb32f4841b", acceptancePath: `${D}/corpus-inputs-1/review-1.json`, acceptance: "1b9c6f58ca7f290afc687ee30c81467d50cb241bf29ec54ae4b738a395bfc01b", sourceRows: "1ea4a7554b6968281b6720e749238995c057380d2d29f016d9061fb3c3ea4acc" },
});
const INSTALLED_TOOL_INPUTS: Readonly<Record<string, readonly [string, string]>> = Object.freeze({
  "node_modules/@types/bun/package.json": ["node_modules/.bun/@types+bun@1.4.0/node_modules/@types/bun/package.json", "7fe2d0d1b7e8b8603827820c2c56cbd15979be31fc77c3ab79ea0c30022a8bfb"],
  "node_modules/typescript/lib/_tsc.js": ["node_modules/.bun/typescript@5.9.3/node_modules/typescript/lib/_tsc.js", "e8f349eabd48486bdb2bf9dc1a00c89d58297270c54b745838879e2859194419"],
  "node_modules/typescript/lib/typescript.js": ["node_modules/.bun/typescript@5.9.3/node_modules/typescript/lib/typescript.js", "3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675"],
  "node_modules/typescript/package.json": ["node_modules/.bun/typescript@5.9.3/node_modules/typescript/package.json", "822ef7ca6452205657b6288b066481ecf508bfbf43455d715cf7d3ec457561e6"],
  "packages/contracts/node_modules/zod/package.json": ["node_modules/.bun/zod@4.6.7/node_modules/zod/package.json", "c2d190d9ee4e0bdb60332aaa2130a6a98d65ddb903fe1d29248b15de57832c45"],
});
let totalRead = 0;
function object(value: unknown): Obj {
  requireThat(value !== null && typeof value === "object" && !Array.isArray(value), "postcheck-object"); return value as Obj;
}
function safe(path: string): void {
  requireThat(path.length > 0 && path.length <= 2048 && /^[A-Za-z0-9_./-]+$/.test(path) && path.split("/").every(p => p !== "" && p !== "." && p !== ".."), "postcheck-relative-path");
  requireThat(!path.startsWith("_work/gpu-owner-recovery/cache/") && !path.includes("/continuation-source-1/home/") && !path.split("/").some(p => [".bun", "node_modules", "target", "compiler-output", "full1", "halted-llvm"].includes(p)) && !/\.(?:tgz|gz|xz|zip|zst|crate|bpk|so|o|rlib|rmeta|bc)$/.test(path), "postcheck-no-cache-or-binary");
}
function read(path: string, cap = MAX_FILE): Buffer {
  requireThat(Number.isSafeInteger(cap) && cap > 0 && cap <= MAX_FILE, "postcheck-read-cap");
  let bytes: Buffer;
  const installed = Object.hasOwn(INSTALLED_TOOL_INPUTS, path) ? INSTALLED_TOOL_INPUTS[path] : undefined;
  if (installed) {
    const resolved = fs.realpathSync(join(ROOT, path));
    requireThat(resolved === `${ROOT}/${installed[0]}`, "postcheck-fixed-installed-tool-input");
    bytes = readRegular(resolved, cap);
    requireThat(sha(bytes) === installed[1], "postcheck-installed-tool-input-pin");
  } else { safe(path); bytes = readRegular(join(ROOT, path), cap); }
  totalRead += bytes.length;
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
    requireThat(typeof row["path"] === "string" && typeof row["sha256"] === "string" && /^[a-f0-9]{64}$/.test(row["sha256"]), "postcheck-source-row");
    const path = row["path"].startsWith(`${ROOT}/`) ? row["path"].slice(ROOT.length + 1) : row["path"];
    requireThat(!seen.has(path), "postcheck-duplicate-source-row");
    seen.add(path); const bytes = read(path);
    requireThat(sha(bytes) === row["sha256"] && (!Object.hasOwn(row, "bytes") || bytes.length === row["bytes"]), "postcheck-source-drift");
  }
}
function pinnedInputMetadata(label: keyof typeof INPUT_PINS, materializationBytes: Buffer, manifestBytes: Buffer, acceptanceBytes: Buffer) {
  const pins = INPUT_PINS[label];
  requireThat(sha(materializationBytes) === pins.materialization && sha(manifestBytes) === pins.manifest && sha(acceptanceBytes) === pins.acceptance, "postcheck-original-input-metadata-pins");
  const materialization = object(JSON.parse(materializationBytes.toString("utf8")) as unknown), inputManifest = object(JSON.parse(manifestBytes.toString("utf8")) as unknown), acceptance = object(JSON.parse(acceptanceBytes.toString("utf8")) as unknown);
  requireThat(materialization["inputManifestSha256"] === pins.manifest && acceptance["inputManifestSha256"] === pins.manifest && inputManifest["reference"] === "b4b241481fb12de4a7344e6dba8eda775af57675", "postcheck-input-metadata-crosslinks");
  requireThat(sha(Buffer.from(JSON.stringify(materialization["files"], null, 2) + "\n")) === pins.sourceRows, "postcheck-original-input-row-digest");
  if (label === "local-inputs-1") requireThat(acceptance["materializationSha256"] === pins.materialization && acceptance["sourceSha256"] === pins.sourceRows, "postcheck-pinned-application-acceptance");
  else requireThat(acceptance["corpusSourceSha256"] === pins.sourceRows, "postcheck-pinned-corpus-acceptance");
  return { materialization, inputManifest };
}
function changedDigest(value: unknown): string {
  requireThat(typeof value === "string" && /^[a-f0-9]{64}$/.test(value), "postcheck-mutation-digest");
  return (value[0] === "0" ? "1" : "0") + value.slice(1);
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
const authorityNames = ["approval2.json", "request.json", "plan.json", "manual-handoff-request1.json", "manual-handoff-plan1.json", "manual-launch-boundary-selection1.json", "manual-source-transport-amendment1.json"].map(name => `${R}/${name}`);
const authority = authorityNames.map(path => { const pin = candidate.inputs.find(row => row.path === path); requireThat(pin, "postcheck-authority-row"); return pin; });
const expectedEvidence = { scope: "SOURCE_PREPARATION_ONLY_NOT_EXECUTION_AUTHORITY", nonAuthorizing: true, packet: packetPin, memberCount: 48, table: candidate.packet.table, inputs: candidate.inputs, authority,
  captureProof: candidate.readiness.captureProof, invocationProof: candidate.readiness.invocationProof, deliveryProof: candidate.deliveryProof, deliveryManifest: candidate.deliveryManifest,
  identitySha256: candidate.readiness.identitySha256, binding: { path: BINDING_PATH, ...byteIdentity(data[0]!) }, readiness: { path: READY_PATH, ...byteIdentity(data[1]!) }, manualAttemptsConsumed: 0, innerAttemptsConsumed: 0, executionReadinessClaimed: false };
const expectedManifest = { version: "chess-coach.sealed-source-packet-manifest.v1", ...expectedEvidence };
const expectedResult = { version: "chess-coach.sealed-source-packet-result.v1", status: RESULT_STATUS, ...expectedEvidence, manifest: { path: MANIFEST_PATH, ...byteIdentity(data[3]!) }, preResultPostchecks: "PASS_PURE_VALIDATORS_AND_UNCACHED_INPUT_READBACK", resultWriteDurabilityClaimed: false, externalExit0AndPostcheckRequired: true };
const metadataMatches = (a: unknown, b: unknown): boolean => equal(a, expectedManifest) && equal(b, expectedResult);
requireThat(metadataMatches(manifest, result), "postcheck-all-emitted-metadata-crosslinks-and-versions");
let metadataMutationNegativesRejected = 0;
for (const target of ["manifest", "result"] as const) {
  for (const field of ["binding", "readiness", "captureProof", "invocationProof", "deliveryProof", "deliveryManifest", "packet", "identitySha256", "authority", "version", "extra"] as const) {
    const a = object(structuredClone(manifest)), b = object(structuredClone(result)), row = target === "manifest" ? a : b;
    if (field === "identitySha256") row[field] = changedDigest(row[field]);
    else if (field === "version") row[field] = "INVALID_RECORD_VERSION";
    else if (field === "extra") row["unexpectedField"] = true;
    else if (field === "authority") { requireThat(Array.isArray(row[field]), "postcheck-authority-mutation-array"); const pin = object(row[field][0]); pin["sha256"] = changedDigest(pin["sha256"]); }
    else { const pin = object(row[field]); pin["sha256"] = changedDigest(pin["sha256"]); }
    requireThat(!metadataMatches(a, b), "postcheck-metadata-mutation-accepted"); metadataMutationNegativesRejected++;
  }
}
const wrongManifestLink = object(structuredClone(result)), wrongPin = object(wrongManifestLink["manifest"]);
wrongPin["sha256"] = changedDigest(wrongPin["sha256"]);
requireThat(!metadataMatches(manifest, wrongManifestLink), "postcheck-result-manifest-mutation-accepted"); metadataMutationNegativesRejected++;
requireThat(metadataMutationNegativesRejected === 23, "postcheck-metadata-negative-count");
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
const canonicalReceipt = json(`${P}/verification-4/receipt.json`);
for (const phase of ["before", "after"] as const) {
  const bytes = read(`${P}/verification-4/sources-${phase}.json`);
  requireThat(sha(bytes) === canonicalReceipt[`${phase}ManifestSha256`], "postcheck-canonical-manifest-pin");
  verifyRows(JSON.parse(bytes.toString("utf8")) as unknown, 92);
}
const originalAuditPath = `${P}/packet-audit-8/receipt.json`, originalAuditBytes = read(originalAuditPath);
requireThat(sha(originalAuditBytes) === "53576528a6241f54eac57f8e854d2ecefab68dbbc758b8041e5d8a7737064f2a", "postcheck-original-input-audit-anchor");
const originalAudit = object(JSON.parse(originalAuditBytes.toString("utf8")) as unknown), auditBindings = originalAudit["bindings"];
requireThat(Array.isArray(auditBindings) && auditBindings.length <= 128 && auditBindings.some(value => { const row = object(value); return row["path"] === INPUT_PINS["corpus-inputs-1"].acceptancePath && row["sha256"] === INPUT_PINS["corpus-inputs-1"].acceptance; }), "postcheck-original-corpus-review-anchor");
requireThat(candidate.inputs.some(row => row.path === INPUT_PINS["local-inputs-1"].acceptancePath && row.sha256 === INPUT_PINS["local-inputs-1"].acceptance), "postcheck-original-application-authority-anchor");
let inputFiles = 0, inputBytes = 0, inputMetadataMutationNegativesRejected = 0;
for (const [label, expectedCount] of [["local-inputs-1", 427], ["corpus-inputs-1", 2]] as const) {
  const base = `${D}/${label}`, materializationBytes = read(`${base}/materialization.json`), inputManifestBytes = read(`${base}/input-manifest.json`), acceptanceBytes = read(INPUT_PINS[label].acceptancePath);
  const { materialization, inputManifest } = pinnedInputMetadata(label, materializationBytes, inputManifestBytes, acceptanceBytes), root = `${base}/inputs/reference`;
  for (const mutate of ["materialization", "manifest", "acceptance"] as const) {
    const a = Buffer.from(materializationBytes), b = Buffer.from(inputManifestBytes), c = Buffer.from(acceptanceBytes);
    const selected = mutate === "materialization" ? a : mutate === "manifest" ? b : c;
    requireThat(selected.length > 0, "postcheck-input-mutation-buffer"); selected[selected.length - 1] = selected[selected.length - 1] === 10 ? 32 : 10;
    let rejected = false; try { pinnedInputMetadata(label, a, b, c); } catch { rejected = true; }
    requireThat(rejected, "postcheck-input-metadata-mutation-accepted"); inputMetadataMutationNegativesRejected++;
  }
  const a = object(JSON.parse(materializationBytes.toString("utf8")) as unknown), b = object(JSON.parse(inputManifestBytes.toString("utf8")) as unknown);
  requireThat(Array.isArray(a["files"]) && Array.isArray(b["entries"]), "postcheck-coordinated-mutation-arrays");
  const firstFile = object(a["files"][0]), firstEntry = object(b["entries"][0]);
  firstFile["sha256"] = changedDigest(firstFile["sha256"]);
  requireThat(typeof firstEntry["gitBlobOid"] === "string" && firstEntry["gitBlobOid"].length === 40, "postcheck-coordinated-git-blob");
  firstEntry["gitBlobOid"] = (firstEntry["gitBlobOid"][0] === "0" ? "1" : "0") + firstEntry["gitBlobOid"].slice(1);
  const changedMaterialization = Buffer.from(JSON.stringify(a, null, 2) + "\n"), changedManifest = Buffer.from(JSON.stringify(b, null, 2) + "\n");
  requireThat(changedMaterialization.length === materializationBytes.length && changedManifest.length === inputManifestBytes.length, "postcheck-coordinated-same-size-case");
  let rejected = false; try { pinnedInputMetadata(label, changedMaterialization, changedManifest, acceptanceBytes); } catch { rejected = true; }
  requireThat(rejected, "postcheck-coordinated-metadata-mutation-accepted"); inputMetadataMutationNegativesRejected++;
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
requireThat(inputMetadataMutationNegativesRejected === 8, "postcheck-input-negative-count");
const absent = ["_work/gpu-owner-recovery/cache", "_work/gpu-owner-recovery/runs/reference-package-handoff-2", `${R}/acquisition-execution-1`, `${R}/acquisition-invocation-1`, `${D}/package-inputs-2`];
for (const path of absent) absentOperational(path);
const observation = {
  version: "chess-coach.r2-source-emission-postcheck.v2", status: "PASS_SOURCE_EMISSION_EXIT0_AND_READBACK_ONLY", nonAuthorizing: true,
  sourceScriptSha256: sha(readRegular(fileURLToPath(import.meta.url), 65536)),
  writer: { exitCode: 0, stdout: byteIdentity(writerStdout), stderr: byteIdentity(writerStderr), expectedStatusLineMatched: true },
  outputs: SOURCE_OUTPUT_PATHS.map((path, index) => ({ path, ...byteIdentity(data[index]!) })), packet: packetPin,
  memberCount: verified.files.size, aggregateSourceBytes: verified.aggregateBytes, snapshotDirectories: verified.directories.length,
  currentImplementationVerdictsVerified: 12, pureWrittenBindingAndReadinessValid: true, all48MembersMatchLiveSource: true, uncachedInputIdentitiesMatch: true,
  allEmittedMetadataCrosslinksAndVersionsValidated: true, metadataMutationNegativesRejected, originalInputMetadataPins: INPUT_PINS, originalInputAuditAnchor: { path: originalAuditPath, sha256: "53576528a6241f54eac57f8e854d2ecefab68dbbc758b8041e5d8a7737064f2a" }, inputMetadataMutationNegativesRejected,
  historicalFilesPreserved: 352, historicalMetadataEntriesPreserved: Object.keys(historicalMetadata).length, protectedSourceAndProofRecordsPreserved: Object.keys(protectedRecords).length,
  frozenSourceBindings: [347, 327, 65], canonicalSourceBindings: 92, inputFilesRehashed: inputFiles, inputBytesRehashed: inputBytes,
  forbiddenOperationalPathsAbsent: absent, installedSupportInputsRead: Object.keys(INSTALLED_TOOL_INPUTS), installedSupportInputsPublished: false, rawArchivesOrOldDownloadCachePayloadsRead: false, dependencyCacheEnumerated: false, nativeExecuted: false, networkRequestsPerformed: 0,
  manualOrInnerAttemptsConsumed: 0, publicationPerformed: false, executionReadinessClaimed: false, trainingReady: false,
  postcheckReceiptRequiresMatchingCompletedCommandExit0: true,
};
exclusive(join(ROOT, REPORT_PATH), encoded(observation, 262144), 262144);
process.stdout.write(`PASS_SOURCE_EMISSION_EXIT0_AND_READBACK_ONLY ${REPORT_PATH}\n`);
