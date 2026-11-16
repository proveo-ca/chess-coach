// SPEC: _spec/runtime-protocol.puml
import * as fs from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, R, SOURCE, equal, sha, readRegular, requireThat } from "../package-acquisition-bun-source2/capture.ts";
import type { EligibilityReader } from "../package-acquisition-bun-source2/capture.ts";
import { createDeliveryRuntime } from "./delivery-bootstrap.ts";
import { renderDelivery } from "./delivery-render.ts";
import { CURRENT_REVIEWS, DELIVERY_SOURCES, FILE_CAP, FIXED_PROTECTED_FILES, PACKET_PATH, PROTECTED_ACTUAL_PATHS, PendingReviews, byteIdentity, prepareCandidate, repositoryReader } from "./seal-ready-packet.ts";
import { SOURCE_OUTPUT_PATHS } from "./seal-ready-packet-emit.ts";

export const OWN_SOURCES = Object.freeze(["seal-ready-packet.ts", "seal-ready-packet.test.ts", "seal-ready-packet.tsconfig.json", "seal-ready-packet-verify.ts", "seal-ready-packet-emit.ts", "seal-ready-packet-emit.test.ts"].map(name => `${R}/${name}`));
const FISH = "/home/agent/toolchains/linux-amd64/.local/share/mise/installs/github-fish-shell-fish-shell/4.9.3/fish";
export const FROZEN_SYNTHETIC_DELIVERY = Object.freeze({
  proof: Object.freeze({ path: `${R}/delivery-verification-15/receipt.json`, sha256: "7b7a6469cbbab55b929c125741ef668063bf886b91ac057b9b08c3dafa1e603d" }),
  manifest: Object.freeze({ path: `${R}/delivery-verification-15/source-manifest.json`, sha256: "c7d36e5287bf4683b0e13f405f6e7d0af313fa0c9ea4dc8717d153e11bcd6400" }),
});
const HISTORY = Object.freeze({ path: `${SOURCE}/freshverification-3/source-manifest.json`, sha256: "eac178a4b15124f1d5e23488735b4234870e9532e5d66c1106f3b181277bb972" });
const SNAPSHOT = Object.freeze({ path: `${R}/reviewed-delivery-source-snapshot-2/manifest.json`, sha256: "794ef8acaec1efaecf605fd1a3d6d070071348acf24a02733c988e8462b7831d" });
const SEAL_SNAPSHOT = Object.freeze({ path: `${R}/seal-source-snapshot-1/manifest.json`, sha256: "c4e292a6c83b32eabf42e25b798f19feed77d75d26b470b2fc33849ccb28d5ee" });
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue { requireThat(value !== null && typeof value === "object" && !Array.isArray(value), "seal-preservation-object"); return value as ObjectValue; }
function preservationRead(path: string): Buffer {
  requireThat(path.startsWith("_work/gpu-owner-recovery/") && path.length <= 1024 && /^[A-Za-z0-9_./-]+$/.test(path) && path.split("/").every(part => part !== "" && part !== "." && part !== ".." && !/^(?:cache|archives?|native|node_modules|\.git|compiler-output|fixtures|__pycache__)$/.test(part)), "seal-literal-preservation-path");
  return readRegular(join(ROOT, path), FILE_CAP);
}
function metadata(path: string) {
  const s = fs.lstatSync(join(ROOT, path), { bigint: true });
  requireThat(!s.isSymbolicLink(), "seal-preserved-nonsymlink");
  return { exists: true, directory: s.isDirectory(), regularFile: s.isFile(), symlink: s.isSymbolicLink(), dev: String(s.dev), ino: String(s.ino), mode: String(s.mode), nlink: String(s.nlink), uid: String(s.uid), gid: String(s.gid), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) };
}
function sealSnapshotState() {
  const bytes = preservationRead(SEAL_SNAPSHOT.path); requireThat(sha(bytes) === SEAL_SNAPSHOT.sha256, "seal-prewriter-snapshot-pin");
  const manifest = object(JSON.parse(bytes.toString()) as unknown), files = manifest["files"];
  requireThat(manifest["sourceCount"] === 4 && manifest["proofRecordCount"] === 15 && Array.isArray(files) && files.length === 19 && manifest["verificationReceiptSha256"] === "5003d5b528214c7c7f0846865c25e31b7d7fd63e657e7a1015153b4682345da9" && manifest["sourceManifestSha256"] === "80d0e2ae098ea87cc1185822a4a21a48762e28d01302e5c77731a091a20d4746", "seal-prewriter-snapshot-inventory");
  const checked: Record<string, unknown> = {};
  const check = (path: string, row: ObjectValue, old: unknown) => {
    const data = preservationRead(path), current = metadata(path), expected = object(old);
    requireThat(equal(byteIdentity(data), { bytes: row["bytes"], sha256: row["sha256"], gitBlobOid: row["gitBlobOid"] }) && Object.entries(expected).every(([key, value]) => (current as Record<string, unknown>)[key] === value), "seal-prewriter-snapshot-byte-or-metadata-drift");
    checked[path] = { ...byteIdentity(data), metadata: current };
  };
  for (const value of files) {
    const row = object(value), copy = row["copy"], original = row["original"];
    requireThat(typeof copy === "string" && /^(sources|proof-5)\/(?:[a-z][a-z0-9.-]*|\.gitignore)$/.test(copy) && typeof original === "string", "seal-prewriter-copy-path");
    check(`${dirname(SEAL_SNAPSHOT.path)}/${copy}`, row, row["copyMetadata"]);
    if (copy.startsWith("proof-5/")) { requireThat(original.startsWith(`${R}/seal-verification-5/`), "seal-prewriter-proof-location"); check(original, row, row["originalMetadata"]); }
  }
  return { ...SEAL_SNAPSHOT, metadata: metadata(SEAL_SNAPSHOT.path), checked };
}
export function preservationState() {
  const pinned = (ref: { path: string; sha256: string }) => { const bytes = preservationRead(ref.path); requireThat(sha(bytes) === ref.sha256, "seal-preservation-manifest-pin"); return object(JSON.parse(bytes.toString()) as unknown); };
  const history = object(pinned(HISTORY)["historical"]), hashes = object(history["hashes"]), oldMetadata = object(history["metadata"]);
  requireThat(Object.keys(hashes).length === 352 && Object.keys(oldMetadata).length >= 352 && Object.keys(oldMetadata).length <= 512, "seal-bounded-historical-inventory");
  const historicalHashes = Object.fromEntries(Object.entries(hashes).map(([path, expected]) => { const actual = sha(preservationRead(path)); requireThat(actual === expected, "seal-historical-byte-drift"); return [path, actual]; }));
  const historicalMetadata = Object.fromEntries(Object.entries(oldMetadata).map(([path, expected]) => {
    requireThat(path.startsWith("_work/gpu-owner-recovery/") && path.length <= 1024 && /^[A-Za-z0-9_./-]+$/.test(path) && path.split("/").every(part => part !== "" && part !== "." && part !== ".."), "seal-historical-metadata-path");
    const actual = metadata(path); requireThat(equal(actual, expected), "seal-historical-metadata-drift"); return [path, actual];
  }));
  const snapshot = pinned(SNAPSHOT), runtime = object(snapshot["protectedRuntime"]), files = snapshot["files"];
  requireThat(snapshot["protectedRuntimeSourceCount"] === 18 && Object.keys(runtime).length === 52 && Array.isArray(files) && files.length === 22, "seal-reviewed-snapshot-inventory");
  const checked: Record<string, unknown> = {};
  const check = (path: string, row: ObjectValue, expectedMetadata: unknown) => {
    const bytes = preservationRead(path), actual = metadata(path), expected = object(expectedMetadata);
    requireThat(bytes.length === row["bytes"] && sha(bytes) === row["sha256"] && Object.entries(expected).every(([key, value]) => (actual as Record<string, unknown>)[key] === value), "seal-runtime-or-snapshot-drift");
    checked[path] = { ...byteIdentity(bytes), metadata: actual };
  };
  for (const [path, row] of Object.entries(runtime)) { const record = object(row); check(path, record, record["metadata"]); }
  for (const value of files) {
    const row = object(value), copy = row["copy"], original = row["original"];
    requireThat(typeof copy === "string" && /^(sources|historical-proof-14|delivery-reviews)\/[a-z][a-z0-9.-]+$/.test(copy) && typeof original === "string", "seal-reviewed-snapshot-literal-copy");
    check(`${dirname(SNAPSHOT.path)}/${copy}`, row, row["copyMetadata"]);
    if (!copy.startsWith("sources/")) check(original, row, row["originalMetadata"]);
  }
  return { manifests: { history: { ...HISTORY, metadata: metadata(HISTORY.path) }, snapshot: { ...SNAPSHOT, metadata: metadata(SNAPSHOT.path) } }, historicalHashes, historicalMetadata, runtimeProtectedRecords: 52, runtimeSourceFiles: 18, readyRuntimeReviews: 8, checked, sealSourceSnapshot: sealSnapshotState() };
}

export function parseSealTestSummary(value: string) {
  const counts: Record<"pass" | "fail", number[]> = { pass: [], fail: [] }; let malformed = Buffer.byteLength(value) > 524288;
  for (const line of value.split(/\r?\n/)) {
    const match = /^[ \t]*(0|[1-9][0-9]*)[ \t]+(pass|fail)[ \t]*$/.exec(line);
    if (match) {
      const count = Number(match[1]); if (!Number.isSafeInteger(count)) malformed = true;
      counts[match[2] as "pass" | "fail"].push(count);
    } else if (/^\s*[+-]?(?:[0-9]\S*|Infinity|NaN)\s+(?:pass|fail)\s*$/.test(line)) malformed = true;
  }
  const testsPassed = counts.pass.length === 1 && Number.isSafeInteger(counts.pass[0]) ? counts.pass[0]! : null;
  const testsFailed = counts.fail.length === 1 && Number.isSafeInteger(counts.fail[0]) ? counts.fail[0]! : null;
  return { valid: !malformed && testsPassed !== null && testsPassed > 0 && testsFailed === 0, testsPassed, testsFailed };
}

export function protectedState() {
  const paths = [...new Set([...FIXED_PROTECTED_FILES, ...PROTECTED_ACTUAL_PATHS, ...SOURCE_OUTPUT_PATHS])];
  return Object.fromEntries(paths.map(path => {
    try {
      const s = fs.lstatSync(join(ROOT, path), { bigint: true });
      const metadata = { dev: String(s.dev), ino: String(s.ino), mode: String(s.mode), nlink: String(s.nlink), size: String(s.size), mtimeNs: String(s.mtimeNs), ctimeNs: String(s.ctimeNs) };
      return [path, { exists: true, ...metadata, ...(s.isFile() && !s.isSymbolicLink() ? byteIdentity(repositoryReader(path, FILE_CAP)) : {}) }];
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return [path, { exists: false }]; throw error; }
  }));
}

export function offlineSyntheticReader(proofPath: string) {
  if (typeof proofPath !== "string" || !new RegExp(`^${R}/delivery-verification-[1-9][0-9]*/receipt\\.json$`).test(proofPath)) throw new Error("explicit-offline-synthetic-proof-path-required");
  requireThat(proofPath === FROZEN_SYNTHETIC_DELIVERY.proof.path, "explicit-current-frozen-synthetic-proof-required");
  const values = new Map<string, Buffer>();
  const manifestPath = `${dirname(proofPath)}/source-manifest.json`;
  const proof = { path: proofPath, sha256: sha(repositoryReader(proofPath, FILE_CAP)) };
  const manifest = { path: manifestPath, sha256: sha(repositoryReader(manifestPath, FILE_CAP)) };
  requireThat(equal(proof, FROZEN_SYNTHETIC_DELIVERY.proof) && equal(manifest, FROZEN_SYNTHETIC_DELIVERY.manifest), "seal-frozen-synthetic-proof-identity");
  for (const path of CURRENT_REVIEWS) {
    const role = path.split("/").at(-1)!.replace(/\.json$/, ""), scope = path.split("/").at(-2)!;
    const row = scope === "delivery" ? {
      version: "chess-coach.r2-scoped-implementation-review.v1", scope, role, session: "ses_OFFLINESYNTHETIC", status: "READY_DELIVERY_IMPLEMENTATION_SCOPE",
      reviewedSource: { path: DELIVERY_SOURCES[0]!, sha256: sha(repositoryReader(DELIVERY_SOURCES[0]!, FILE_CAP)) }, verificationReceipt: proof, sourceManifest: manifest,
      remainingFindings: [], nonAuthorizing: true, executionReadinessClaimed: false, trainingReady: false,
    } : JSON.parse(repositoryReader(path, FILE_CAP).toString()) as Record<string, unknown>;
    values.set(path, Buffer.from(JSON.stringify({ ...row, syntheticFixtureScope: "OFFLINE_SYNTHETIC" })));
  }
  const reader: EligibilityReader = (path, cap) => {
    const bytes = values.get(path) ?? repositoryReader(path, cap);
    if (bytes.length > cap) throw new Error("synthetic-reader-cap"); return Buffer.from(bytes);
  };
  return { values, reader, proof, manifest };
}

export async function observeCurrentGate() {
  const observedRolePins: { path: string; bytes: number; sha256: string; gitBlobOid: string }[] = [];
  const absentAtRead: string[] = [];
  const read: EligibilityReader = (path, cap) => {
    try { const bytes = repositoryReader(path, cap); if (CURRENT_REVIEWS.includes(path)) observedRolePins.push({ path, ...byteIdentity(bytes) }); return bytes; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT" && CURRENT_REVIEWS.includes(path)) absentAtRead.push(path); throw error; }
  };
  try {
    const candidate = await prepareCandidate(read, CURRENT_REVIEWS), api = await createDeliveryRuntime();
    const envelope = object(JSON.parse(candidate.packet.bytes.toString()) as unknown);
    const apiResponseBytes = Buffer.byteLength(JSON.stringify({ encoding: "base64", sha: candidate.packet.pin.gitBlobOid, size: candidate.packet.bytes.length, content: candidate.packet.bytes.toString("base64") }));
    const candidateSummary = {
      scope: "IN_MEMORY_NONAUTHORIZING_CANDIDATE_EVIDENCE_ONLY", nonAuthorizing: true, candidateBytesPersisted: false,
      memberCount: candidate.paths.length, aggregateBytes: envelope["aggregateBytes"], directoryCount: (envelope["directories"] as unknown[]).length,
      packetBytes: candidate.packet.bytes.length, apiResponseBytes, maximumMemberBytes: Math.max(...candidate.packet.table.map(row => row.bytes)), limits: api.constants.limits,
      sourceHashes: candidate.identity.sourceHashes, hashes: candidate.readiness.hashes, identitySha256: candidate.readiness.identitySha256,
      captureProof: candidate.readiness.captureProof, invocationProof: candidate.readiness.invocationProof, deliveryProof: candidate.deliveryProof, deliveryManifest: candidate.deliveryManifest,
      pureValidation: { validateEligibility: "PASS_PURE_INJECTED_READER", validateInvocationReady: "PASS_PURE_INJECTED_READER", validatePacket: "PASS_PURE_IN_MEMORY" },
      table: candidate.packet.table,
    };
    return { status: "ALL_VALID_IN_MEMORY_NOT_EMITTED" as const, missing: [], absentAtRead, observedRolePins, actualDerivedRecordsWritten: false, candidateSummary };
  } catch (error) {
    if (error instanceof PendingReviews) return { status: error.status, missing: error.missing, absentAtRead, observedRolePins, actualDerivedRecordsWritten: false };
    return { status: "REJECTED_CURRENT_EVIDENCE" as const, missing: [], absentAtRead, observedRolePins, failure: error instanceof Error ? error.message.slice(0, 256) : "unknown-current-gate-rejection", actualDerivedRecordsWritten: false };
  }
}

export async function verifySealPreparation(): Promise<void> {
  const api = await createDeliveryRuntime();
  api.need(process.cwd() === ROOT && process.versions["bun"] === "1.4.0" && process.execArgv.includes("--no-env-file") && process.execArgv.includes("--no-install"), "seal-pinned-bun-required");
  api.need(JSON.parse(fs.readFileSync(join(ROOT, "node_modules/typescript/package.json"), "utf8")).version === "5.9.3", "seal-existing-typescript-required");
  let evidence = "";
  for (let i = 1; i <= 999; i++) {
    try { const candidate = join(ROOT, R, `seal-verification-${i}`); api.freshDirectory(candidate); evidence = candidate; break; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }
  api.need(evidence !== "", "seal-fresh-evidence-exhausted");
  const write = (name: string, value: unknown) => {
    const bytes = Buffer.from(JSON.stringify(value, null, 2) + "\n"); api.need(bytes.length <= FILE_CAP, "seal-evidence-cap"); api.writeExclusive(join(evidence, name), bytes);
  };
  api.writeExclusive(join(evidence, ".gitignore"), Buffer.from("fixtures/\ncompiler-output/\n"));
  const before = protectedState(), preservationBefore = preservationState();
  api.need(PROTECTED_ACTUAL_PATHS.every(path => before[path]?.exists === false), "seal-real-derived-and-operational-roots-must-stay-absent");
  api.need(SOURCE_OUTPUT_PATHS.every(path => before[path]?.exists === false), "seal-five-source-outputs-must-stay-absent");
  write("readchecks-before.json", before);
  write("preservation-before.json", preservationBefore);
  const sources = Object.fromEntries(OWN_SOURCES.map(path => [path, byteIdentity(repositoryReader(path, FILE_CAP))]));
  write("source-manifest.json", { scope: "OFFLINE_SEAL_PREPARATION_SOURCE_ONLY", sources });
  const syntheticProofPath = process.env["SEAL_SYNTHETIC_DELIVERY_PROOF"];
  api.need(typeof syntheticProofPath === "string", "explicit-frozen-synthetic-delivery-proof-required");
  const synthetic = offlineSyntheticReader(syntheticProofPath!), candidate = await prepareCandidate(synthetic.reader, CURRENT_REVIEWS);
  const rendered = await renderDelivery({ ...candidate.packet.pin, commitOid: "1".repeat(40), packetPath: PACKET_PATH, fileTable: candidate.packet.table }, "OFFLINE_SYNTHETIC_NONRUNNING");
  api.need(rendered.body.split("\n")[1] === "exit 1" && rendered.runnableOperatorCommand === false, "seal-nonrunning-fish-only");
  api.writeExclusive(join(evidence, "synthetic-nonrunning.fish"), Buffer.from(rendered.body));
  const commands = [
    { name: "tests", executable: process.execPath, args: ["--no-env-file", "--no-install", "test", `${R}/seal-ready-packet.test.ts`, `${R}/seal-ready-packet-emit.test.ts`, "--timeout", "10000"], env: { LANG: "C", LC_ALL: "C", SEAL_EVIDENCE_ROOT: evidence, SEAL_SYNTHETIC_DELIVERY_PROOF: syntheticProofPath } },
    { name: "typecheck", executable: process.execPath, args: ["--no-env-file", "--no-install", "node_modules/typescript/bin/tsc", "-p", `${R}/seal-ready-packet.tsconfig.json`], env: { LANG: "C", LC_ALL: "C" } },
    { name: "fish-syntax", executable: FISH, args: ["--no-config", "--no-execute", join(evidence, "synthetic-nonrunning.fish")], env: { LANG: "C", LC_ALL: "C" } },
  ];
  const results = []; let testText = "";
  for (const command of commands) {
    const origin = process.hrtime.bigint();
    const result = await api.runChild({ ...command, cwd: ROOT, stdoutCap: 262144, stderrCap: 262144, remainingMs: () => 60000 - Number(process.hrtime.bigint() - origin) / 1e6, workMs: 58000, cleanupMs: 2000 });
    api.writeExclusive(join(evidence, `${command.name}.stdout`), result.stdout); api.writeExclusive(join(evidence, `${command.name}.stderr`), result.stderr);
    if (command.name === "tests") testText = result.stdout.toString() + "\n" + result.stderr.toString();
    const { stdout, stderr, ...facts } = result;
    results.push({ name: command.name, argv: [command.executable, ...command.args], ...facts, stdout: byteIdentity(stdout), stderr: byteIdentity(stderr) });
  }
  const actualGate = await observeCurrentGate(); write("current-gate-observation.json", { currentReviewPaths: CURRENT_REVIEWS, observationTiming: "AFTER_OFFLINE_TESTS_TYPECHECK_FISH_BEFORE_FINAL_IMMUTABLE_READCHECKS", ...actualGate });
  const after = protectedState(), preservationAfter = preservationState(); write("readchecks-after.json", after); write("preservation-after.json", preservationAfter);
  const summary = parseSealTestSummary(testText), sourceUnchanged = Object.entries(sources).every(([path, pin]) => equal(pin, byteIdentity(repositoryReader(path, FILE_CAP))));
  const commandsValid = results.length === 3 && results.every(row => row.spawned === true && Number.isSafeInteger(row.pid) && row.pid !== null && row.pid > 0 && row.exitCode === 0 && row.signal === null && row.failure === null && row.reaped && row.closed && row.outEOF && row.errEOF && row.cleanupConfirmed && row.processGroupGone === true && !row.cleanupExpired && !row.cleanupClockFailed && !row.interrupted && !row.pipesDestroyed && !row.pipeCleanupFailed && !row.pipeDestructionAttempted && !row.signalFailure);
  const readchecksMatch = equal(before, after), preservationMatch = equal(preservationBefore, preservationAfter);
  const currentGateValid = actualGate.status === "ALL_VALID_IN_MEMORY_NOT_EMITTED" && actualGate.observedRolePins.length === 12 && equal(actualGate.observedRolePins.map(row => row.path), CURRENT_REVIEWS) && actualGate.observedRolePins.every(row => equal(row, { path: row.path, ...byteIdentity(repositoryReader(row.path, FILE_CAP)) }));
  const passed = summary.valid && commandsValid && readchecksMatch && preservationMatch && sourceUnchanged && currentGateValid;
  const receipt = {
    version: "chess-coach.offline-seal-preparation-verification.v1", status: passed ? "PASS_OFFLINE_SOURCE_PREPARATION_AWAITING_LEAD_REVIEW_AND_RELEASE" : "FAIL_OFFLINE_SOURCE_PREPARATION",
    evidence, sources, ...summary, commandsValid, readchecksMatch, preservationMatch, sourceUnchanged, currentGateValid, results, actualGate, currentReviewPaths: CURRENT_REVIEWS,
    runtime: { bun: process.versions["bun"], executable: process.execPath, typescript: "5.9.3", strictNoEmit: true, noInstall: true },
    syntheticCandidate: { scope: "OFFLINE_SYNTHETIC", explicitlySelectedProofPath: syntheticProofPath, deliveryProof: synthetic.proof, deliveryManifest: synthetic.manifest, deliverySources: Object.fromEntries(DELIVERY_SOURCES.map(path => [path, byteIdentity(repositoryReader(path, FILE_CAP))])), members: candidate.paths.length, protectedMaterializedMembers: candidate.paths.length - CURRENT_REVIEWS.length, syntheticReviewFilesMaterialized: 0, packetBytes: candidate.packet.bytes.length, aggregateBytes: JSON.parse(candidate.packet.bytes.toString()).aggregateBytes as number, fixtureOnly: true, fakeCommitOidUsedOnlyInNonrunningSyntaxFixture: true },
    actualBindingCreated: false, actualReadinessCreated: false, actualPacketCreated: false, finalSealCreated: false, historical352FreshlyRevalidated: preservationMatch, historicalFiles: Object.keys(preservationBefore.historicalHashes).length, historicalMetadataEntries: Object.keys(preservationBefore.historicalMetadata).length, runtimeProtectedRecords: 52, runtimeSourceFiles: 18, readyRuntimeReviews: 8,
    actualEmitterMainInvoked: false, actualFiveSourceOutputsCreated: false, writerTestsScope: "PROTECTED_REPOSITORY_FIXTURES_ONLY_WITH_ACTUAL_REVIEW_BYTES_AND_FAULT_INJECTION", sourceFilesQualified: 6, prewriterSourceSnapshot: SEAL_SNAPSHOT,
    productionEntryInvoked: false, productionWorkerInvoked: false, productionAdapterInstantiated: false, realNetworkRequests: 0, networkListenersStarted: false,
    fishExecuted: false, fishNoExecuteChecked: results[2]!.exitCode === 0 && results[2]!.failure === null, publicationPerformed: false, gitMutationPerformed: false,
    manualAttemptsConsumed: 0, innerAttemptsConsumed: 0, nonAuthorizing: true, executionReadinessClaimed: false,
  };
  write("receipt.json", receipt);
  process.stdout.write(`${receipt.status} ${evidence}/receipt.json\n`); process.exitCode = passed ? 0 : 1;
}
if (import.meta.main) {
  try { await verifySealPreparation(); }
  catch (error) { process.stderr.write(`${error instanceof Error ? error.message : "seal-verification-failed"}\n`); process.exitCode = 1; }
}
