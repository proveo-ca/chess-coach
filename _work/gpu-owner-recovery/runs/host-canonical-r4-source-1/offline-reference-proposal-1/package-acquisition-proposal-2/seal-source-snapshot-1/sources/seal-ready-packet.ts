// SPEC: _spec/runtime-protocol.puml
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { AUTHORITY_FILES, CAPS, GRANT, PINS, R, ROOT, SOURCE, SOURCE_FILES, encoded, equal, readRegular, requireThat, sha, sourceHashes, validateEligibility } from "../package-acquisition-bun-source2/capture.ts";
import type { EligibilityReader } from "../package-acquisition-bun-source2/capture.ts";
import { invocationHashes, runtimeEligibilityReads, validateInvocationReady } from "./invoke-approved-bun.ts";
import { createDeliveryRuntime } from "./delivery-bootstrap.ts";
import { buildLiteralPacket } from "./delivery-packet.ts";

export const ROLES = Object.freeze(["backend", "devops", "adversarial", "security"] as const);
export const SCOPES = Object.freeze(["capture", "caller", "delivery"] as const);
export const CURRENT_REVIEWS: readonly string[] = Object.freeze(SCOPES.flatMap(scope => ROLES.map(role => `${R}/implementation-review-${scope === "delivery" ? 4 : 2}/${scope}/${role}.json`)));
export const CAPTURE_PROOF = Object.freeze({ path: `${SOURCE}/fullverification-9/receipt.json`, sha256: "f780bbf4aa007deece850ba688b7200df1b4b31feebaea52045d5259b3dbfe27" });
export const CALLER_PROOF = Object.freeze({ path: `${R}/invocation-verification-6/receipt.json`, sha256: "d006193dbbcdcdb802b939eb531f157dcfc18d960f9f11d8f3e7b657127e684c" });
export const BINDING_PATH = `${SOURCE}/execution-binding2.json`;
export const READY_PATH = `${R}/invocation-ready2.json`;
export const PACKET_PATH = `${R}/source-packet1.json`;
export const READS_PATH = `${R}/runtime-eligibility-reads2.json`;
export const DELIVERY_SOURCES = Object.freeze(["delivery-bootstrap.ts", "delivery-packet.ts", "delivery-render.ts", "delivery.test.ts", "delivery-verify.ts", "delivery.tsconfig.json", "delivery-contract1.json"].map(name => `${R}/${name}`));
export const FILE_CAP = 1048576;
const HEX = /^[0-9a-f]{64}$/;
type RecordValue = Record<string, unknown>;
type Reference = { path: string; sha256: string };
type Scope = typeof SCOPES[number];
const READY_REVIEWS = Object.freeze(Object.fromEntries(ROLES.map(role => [role, "READY"])));
const MANIFEST_PINS = Object.freeze({ capture: "9de207966836330d95e72af6f433850669412b0eafe28b214e0531794c71bad7", caller: "3a2a69719e40bb3b6622f5a43651b9d8414652a6136fbcd21f257847bbec6e1f" });

function object(value: unknown): RecordValue {
  requireThat(value !== null && typeof value === "object" && !Array.isArray(value), "seal-object-required");
  return value as RecordValue;
}
function exact(value: object, keys: readonly string[]): void {
  requireThat(equal(Object.keys(value).sort(), [...keys].sort()), "seal-exact-fields");
}
function text(bytes: Buffer): string {
  const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  requireThat(!/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) && Buffer.from(value).equals(bytes), "seal-text-only");
  return value;
}
function decode(bytes: Buffer): RecordValue { return object(JSON.parse(text(bytes)) as unknown); }
function safePath(path: string): void {
  requireThat(typeof path === "string" && path.length > 0 && path.length <= 1024 && /^[A-Za-z0-9_./-]+$/.test(path) && path.split("/").every(part => part !== "" && part !== "." && part !== ".."), "seal-relative-path");
  requireThat(!path.split("/").some(part => /^(?:cache|archives?|node_modules|\.git|native|compiler-output|fixtures|__pycache__|reference-package-inputs-[12]|package-inputs-[12]|acquisition-execution-\d+|acquisition-invocation-\d+|reference-package-handoff-\d+)$/i.test(part)), "seal-prohibited-source");
}
function reference(value: unknown): Reference {
  const row = object(value); exact(row, ["path", "sha256"]);
  requireThat(typeof row["path"] === "string" && typeof row["sha256"] === "string" && HEX.test(row["sha256"]), "seal-reference");
  safePath(row["path"]); return { path: row["path"], sha256: row["sha256"] };
}
function positive(value: unknown): void { requireThat(typeof value === "number" && Number.isSafeInteger(value) && value > 0, "seal-positive-safe-count"); }
function flags(row: RecordValue, names: readonly string[], expected: boolean): void {
  for (const name of names) requireThat(row[name] === expected, `seal-proof-flag:${name}`);
}
export function byteIdentity(bytes: Uint8Array) {
  return { bytes: bytes.length, sha256: sha(bytes), gitBlobOid: createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex") };
}
export class PendingReviews extends Error {
  readonly status = "PENDING_CURRENT_REVIEWS";
  constructor(readonly missing: readonly string[]) { super(`seal-current-reviews-missing:${missing.join(",")}`); }
}
export function repositoryReader(path: string, cap: number): Buffer {
  safePath(path); requireThat(Number.isSafeInteger(cap) && cap > 0, "seal-read-cap");
  return readRegular(join(ROOT, path), Math.min(cap, FILE_CAP));
}
function reviewGate(read: EligibilityReader, paths: readonly string[]): Map<Scope, RecordValue[]> {
  requireThat(Array.isArray(paths) && equal(paths, CURRENT_REVIEWS), "seal-exact-twelve-review-paths");
  const missing: string[] = [], rows = new Map<Scope, RecordValue[]>();
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i]!, scope = SCOPES[Math.floor(i / 4)]!, role = ROLES[i % 4]!;
    let bytes: Buffer;
    try { bytes = read(path, CAPS.receipt); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") { missing.push(path); continue; } throw error; }
    const row = decode(bytes);
    requireThat(row["version"] === "chess-coach.r2-scoped-implementation-review.v1" && row["scope"] === scope && row["role"] === role && row["status"] === `READY_${scope.toUpperCase()}_IMPLEMENTATION_SCOPE`, "seal-current-role-not-ready");
    requireThat(typeof row["session"] === "string" && /^ses_[A-Za-z0-9]{1,128}$/.test(row["session"]), "seal-review-session");
    flags(row, ["nonAuthorizing"], true); flags(row, ["executionReadinessClaimed", "trainingReady"], false);
    requireThat(Array.isArray(row["remainingFindings"]) && row["remainingFindings"].length === 0, "seal-review-findings");
    for (const [key, value] of Object.entries(row)) if (/findings$/i.test(key)) requireThat(Array.isArray(value) && value.length === 0, "seal-review-findings");
    reference(row["reviewedSource"]); reference(row["verificationReceipt"]); reference(row["sourceManifest"]);
    rows.set(scope, [...(rows.get(scope) ?? []), row]);
  }
  if (missing.length) throw new PendingReviews(Object.freeze(missing));
  requireThat(SCOPES.every(scope => rows.get(scope)?.length === 4), "seal-twelve-current-roles");
  return rows;
}
function commandProof(value: unknown, delivery: boolean): void {
  const row = object(value);
  requireThat(row["exitCode"] === 0 && row["signal"] === null && row["failure"] === null && row["reaped"] === true, "seal-proof-command-failed");
  if (!delivery) { flags(row, ["pipesCompleted"], true); return; }
  positive(row["pid"]);
  flags(row, ["spawnAttempted", "spawned", "closed", "outEOF", "errEOF", "cleanupConfirmed", "processGroupGone"], true);
  flags(row, ["spawnError", "noChildCreated", "interrupted", "cleanupExpired", "cleanupClockFailed", "pipesDestroyed", "pipeDestructionAttempted", "pipeCleanupFailed", "signalFailure"], false);
  requireThat(row["cancellationSignal"] === null, "seal-proof-command-cancellation");
}
function runtimeProof(row: RecordValue, expectedTests: number): void {
  requireThat(row["status"] === "PASS_OFFLINE_ONLY" && row["testsPassed"] === expectedTests && row["testsFailed"] === 0 && row["typecheckExitCode"] === 0, "seal-runtime-proof");
  flags(row, ["readchecksMatch", "productionAbsent"], true);
  flags(row, ["productionAdapterInstantiated", "productionEntryInvoked", "productionWorkerInvoked", "productionRootsTouched", "productionCacheParentCreated", "productionDestinationsCreated"], false);
  requireThat(row["actualGetRequests"] === 0 && row["clockContract"] === "PROCESS_LOCAL_DURATION_V1" && row["readchecksBeforeSha256"] === row["readchecksAfterSha256"] && typeof row["readchecksBeforeSha256"] === "string" && HEX.test(row["readchecksBeforeSha256"]), "seal-runtime-readchecks");
  const runtime = object(row["runtime"]);
  requireThat(runtime["bun"] === "1.4.0" && runtime["typescript"] === "5.9.3" && runtime["strictNoEmit"] === true && equal(runtime["flags"], ["--no-env-file", "--no-install"]), "seal-runtime-toolchain");
  commandProof(row["tests"], false); commandProof(row["typecheck"], false);
}
function checkReviewIdentity(rows: readonly RecordValue[], main: Reference, proof: Reference, manifest: Reference, testsPassed: number): void {
  for (const row of rows) {
    requireThat(equal(reference(row["reviewedSource"]), main) && equal(reference(row["verificationReceipt"]), proof) && equal(reference(row["sourceManifest"]), manifest), "seal-review-identity-mismatch");
    for (const [key, expected] of [["recordedTestsPassed", testsPassed], ["recordedTestsFailed", 0], ["recordedStrictTypecheckExitCode", 0]] as const) if (Object.hasOwn(row, key)) requireThat(row[key] === expected, "seal-review-recorded-proof");
    if (Object.hasOwn(row, "captureProofMatchesCurrentSource")) requireThat(row["captureProofMatchesCurrentSource"] === true, "seal-review-capture-source");
  }
}

export async function prepareCandidate(reader: EligibilityReader, current12literalReviewPaths: readonly string[]) {
  const cache = new Map<string, Buffer>();
  const read: EligibilityReader = (path, requestedCap) => {
    safePath(path); requireThat(Number.isSafeInteger(requestedCap) && requestedCap > 0, "seal-read-cap");
    const cap = Math.min(requestedCap, FILE_CAP);
    let bytes = cache.get(path);
    if (!bytes) { const supplied = reader(path, cap); requireThat(Buffer.isBuffer(supplied) && supplied.length <= cap, "seal-file-cap"); bytes = Buffer.from(supplied); text(bytes); cache.set(path, bytes); }
    requireThat(bytes.length <= cap, "seal-file-cap"); return Buffer.from(bytes);
  };
  const reviews = reviewGate(read, current12literalReviewPaths);
  const api = await createDeliveryRuntime(), C = api.constants;
  const readsBytes = read(READS_PATH, FILE_CAP);
  requireThat(sha(readsBytes) === "a5291e1f2e2e1c3a59faedec3c2c48045b18548413ff5c0ef91a53369cba56b8", "seal-literal-runtime-reads-pin");
  const runtimePaths = runtimeEligibilityReads(CAPTURE_PROOF.path, CALLER_PROOF.path), reads = decode(readsBytes);
  requireThat(runtimePaths.length === 32 && equal(reads["reads"], runtimePaths) && reads["requiredReadCount"] === 32, "seal-exact-runtime-closure");
  const allowed = new Set([...CURRENT_REVIEWS, READS_PATH, ...runtimePaths, ...DELIVERY_SOURCES, C.BOUNDARY_PATH, C.AMENDMENT_PATH]);
  const boundedRead: EligibilityReader = (path, cap) => { requireThat(allowed.has(path), "seal-nonliteral-read"); return read(path, cap); };
  const checked = (ref: Reference): Buffer => { const bytes = boundedRead(ref.path, CAPS.receipt); requireThat(sha(bytes) === ref.sha256, "seal-proof-reference-hash"); return bytes; };
  const captureBytes = checked(CAPTURE_PROOF), callerBytes = checked(CALLER_PROOF), capture = decode(captureBytes), caller = decode(callerBytes);
  runtimeProof(capture, 751); runtimeProof(caller, 185);
  requireThat(capture["version"] === "chess-coach.bun-offline-verification.v1" && caller["version"] === "chess-coach.bun-invocation-verification.v1", "seal-runtime-proof-version");
  flags(capture, ["clockProofValid", "parentIntegrationProofValid"], true);
  requireThat(equal(caller["captureProof"], CAPTURE_PROOF) && caller["captureProofMatchesSource"] === true, "seal-caller-capture-proof");
  const hashes = invocationHashes(boundedRead), captureHashes = sourceHashes(boundedRead);
  requireThat(Object.keys(hashes.caller).length === 4 && Object.keys(hashes.source).length === 12 && Object.keys(hashes.observer).length === 2 && equal(capture["hashes"], hashes) && equal(caller["hashes"], hashes), "seal-eighteen-runtime-sources");
  requireThat(equal(capture["sourceHashes"], captureHashes) && equal(caller["sourceHashes"], captureHashes), "seal-capture-source-hashes");
  for (const [name, pin] of C.fixedInputs) requireThat(sha(boundedRead(name, FILE_CAP)) === pin, "seal-observer-or-lock-drift");
  for (const [scope, receipt, ref] of [["capture", capture, CAPTURE_PROOF], ["caller", caller, CALLER_PROOF]] as const) {
    const manifest = { path: `${dirname(ref.path)}/source-manifest.json`, sha256: MANIFEST_PINS[scope] };
    const actual = decode(checked(manifest));
    requireThat(receipt["sourceManifestSha256"] === manifest.sha256 && equal(actual, scope === "capture" ? { sourceHashes: captureHashes, bindings: PINS, choiceSha256: PINS.approval } : hashes), "seal-runtime-manifest");
    checkReviewIdentity(reviews.get(scope)!, { path: scope === "capture" ? `${SOURCE}/capture.ts` : `${R}/invoke-approved-bun.ts`, sha256: scope === "capture" ? captureHashes["capture.ts"]! : hashes.caller[`${R}/invoke-approved-bun.ts`]! }, ref, manifest, scope === "capture" ? 751 : 185);
  }
  const deliveryRows = reviews.get("delivery")!, deliveryProof = reference(deliveryRows[0]!["verificationReceipt"]), deliveryManifest = reference(deliveryRows[0]!["sourceManifest"]);
  requireThat(deliveryProof.path.startsWith(`${R}/delivery-verification-`) && new RegExp(`^${R}/delivery-verification-[1-9][0-9]*/receipt\\.json$`).test(deliveryProof.path) && deliveryManifest.path === `${dirname(deliveryProof.path)}/source-manifest.json`, "seal-delivery-proof-location");
  allowed.add(deliveryProof.path); allowed.add(deliveryManifest.path);
  const delivery = decode(checked(deliveryProof)), manifest = decode(checked(deliveryManifest));
  positive(delivery["testsPassed"]);
  requireThat(delivery["version"] === "chess-coach.offline-delivery-verification.v3" && delivery["status"] === "PASS_OFFLINE_DELIVERY_REVIEW_FIXES_AWAITING_FOUR_REFRESHED_REVIEWS" && delivery["testsFailed"] === 0, "seal-delivery-proof-status");
  const sources = Object.fromEntries(DELIVERY_SOURCES.map(path => [path, byteIdentity(boundedRead(path, FILE_CAP))]));
  requireThat(equal(delivery["sources"], sources) && equal(manifest["sources"], sources) && manifest["scope"] === "OFFLINE_DELIVERY_SOURCE_ONLY" && manifest["finalPacketCreated"] === false && manifest["finalClosureFrozen"] === false, "seal-seven-delivery-source-manifest");
  checkReviewIdentity(deliveryRows, { path: DELIVERY_SOURCES[0]!, sha256: sources[DELIVERY_SOURCES[0]!]!.sha256 }, deliveryProof, deliveryManifest, delivery["testsPassed"] as number);
  const assessment = object(delivery["assessment"]), toolchain = object(delivery["runtime"]);
  flags(assessment, ["passed", "summaryValid", "commandsValid", "readchecksMatch", "sourceUnchanged"], true);
  requireThat(assessment["version"] === "EXACT_LINE_SUMMARIES_AND_OBSERVED_COMMAND_FACTS_V1" && assessment["testsPassed"] === delivery["testsPassed"] && assessment["testsFailed"] === 0, "seal-delivery-assessment");
  requireThat(toolchain["bun"] === "1.4.0" && toolchain["typescript"] === "5.9.3" && toolchain["strictNoEmit"] === true && toolchain["noInstall"] === true, "seal-delivery-toolchain");
  flags(delivery, ["immutableAndHistoricalReadchecksMatch", "sourceUnchanged", "fishNoExecuteChecked"], true);
  flags(delivery, ["publicAccessibilityVerified", "productionRootsCreated", "productionRunEntered", "productionTransportInvoked", "productionEntryGateProbed", "networkListenersStarted", "fishExecuted", "finalPacketCreated", "actualClosureFrozen", "bindingsOrReadyRecordsCreated", "publicationPerformed", "runnableOperatorCommandDelivered", "executionReadinessClaimed"], false);
  requireThat(delivery["realNetworkRequests"] === 0 && delivery["actualManualAttemptsConsumed"] === 0 && delivery["actualInnerAttemptsConsumed"] === 0 && equal(delivery["unresolvedTransportBlockers"], []), "seal-delivery-offline-only");
  const results = delivery["results"];
  requireThat(Array.isArray(results) && results.length === 3 && ["tests", "typecheck", "fish-syntax"].every(name => results.filter(value => object(value)["name"] === name).length === 1), "seal-delivery-proof-commands");
  for (const result of results) commandProof(result, true);
  for (const [path, pin] of [[C.BOUNDARY_PATH, C.BOUNDARY_SHA], [C.AMENDMENT_PATH, C.AMENDMENT_SHA]] as const) requireThat(sha(boundedRead(path, FILE_CAP)) === pin, "seal-boundary-or-amendment-pin");
  requireThat(object(delivery["launchBoundary"])["path"] === C.BOUNDARY_PATH && object(delivery["launchBoundary"])["sha256"] === C.BOUNDARY_SHA && object(delivery["transportAmendment"])["path"] === C.AMENDMENT_PATH && object(delivery["transportAmendment"])["sha256"] === C.AMENDMENT_SHA, "seal-delivery-authority-pins");
  const binding = encoded({ version: "chess-coach.bun-execution-binding.v1", grantId: GRANT, nonAuthorizing: true, sourceHashes: captureHashes, bindings: PINS, choiceSha256: PINS.approval, verificationReceipt: CAPTURE_PROOF, reviews: READY_REVIEWS });
  const overlays = new Map<string, Buffer>([[BINDING_PATH, binding]]);
  const overlayRead: EligibilityReader = (path, cap) => {
    const bytes = overlays.get(path); if (!bytes) return boundedRead(path, cap);
    requireThat(bytes.length <= Math.min(cap, FILE_CAP), "seal-overlay-cap"); return Buffer.from(bytes);
  };
  const identity = validateEligibility(overlayRead);
  const ready = encoded({ version: "chess-coach.bun-invocation-readiness.v1", nonAuthorizing: true, grantId: GRANT, hashes, identitySha256: sha(encoded(identity)), invocationProof: CALLER_PROOF, captureProof: CAPTURE_PROOF, reviews: { caller: "READY", capture: READY_REVIEWS } });
  overlays.set(READY_PATH, ready);
  const readiness = validateInvocationReady(identity, overlayRead);
  const paths = Object.freeze([...runtimePaths, C.BOUNDARY_PATH, C.AMENDMENT_PATH, ...CURRENT_REVIEWS, deliveryProof.path, deliveryManifest.path]);
  requireThat(paths.length === 48 && new Set(paths).size === paths.length && !paths.includes(PACKET_PATH) && DELIVERY_SOURCES.every(path => !paths.includes(path)), "seal-exact-forty-eight-member-union");
  for (const path of paths) { api.safePath(path); overlayRead(path, FILE_CAP); }
  const packet = await buildLiteralPacket({ scope: "LEAD_FROZEN_LITERAL_CLOSURE", paths }, path => overlayRead(path, FILE_CAP));
  requireThat(packet.table.every(row => equal(row, { path: row.path, ...byteIdentity(overlayRead(row.path, FILE_CAP)) })), "seal-table-byte-identities");
  const verified = api.validatePacket(packet.bytes, packet.pin, packet.table);
  const packetRead: EligibilityReader = (path, cap) => { const bytes = verified.files.get(path); requireThat(bytes && bytes.length <= Math.min(cap, FILE_CAP), "seal-packet-read-closure"); return Buffer.from(bytes); };
  requireThat(equal(validateEligibility(packetRead), identity) && equal(validateInvocationReady(identity, packetRead), readiness), "seal-packet-pure-validation");
  requireThat(equal([...verified.files.keys()], paths) && verified.aggregateBytes <= C.limits.source && packet.bytes.length <= C.limits.packet && Buffer.byteLength(JSON.stringify({ encoding: "base64", sha: packet.pin.gitBlobOid, size: packet.bytes.length, content: packet.bytes.toString("base64") })) <= C.limits.response, "seal-total-caps");
  const inputs = Object.freeze([...cache].map(([path, bytes]) => Object.freeze({ path, ...byteIdentity(bytes) })));
  return { scope: "IN_MEMORY_NONAUTHORIZING_CANDIDATE_ONLY" as const, nonAuthorizing: true as const, paths, binding, ready, packet, identity, readiness, deliveryProof, deliveryManifest, inputs };
}

export const PROTECTED_ACTUAL_PATHS = Object.freeze([
  "_work/gpu-owner-recovery/runs/reference-package-handoff-2", "_work/gpu-owner-recovery/cache",
  `${R}/acquisition-execution-1`, `${R}/acquisition-invocation-1`,
  `${SOURCE.slice(0, SOURCE.lastIndexOf("/"))}/package-inputs-2`, BINDING_PATH, READY_PATH, PACKET_PATH,
]);
export const FIXED_PROTECTED_FILES = Object.freeze([...Object.keys(AUTHORITY_FILES), ...SOURCE_FILES.map(name => `${SOURCE}/${name}`), ...runtimeEligibilityReads(CAPTURE_PROOF.path, CALLER_PROOF.path).filter(path => path !== BINDING_PATH && path !== READY_PATH), ...DELIVERY_SOURCES, ...CURRENT_REVIEWS, `${R}/implementation-reviews-complete1.json`, READS_PATH, `${R}/manual-launch-boundary-selection1.json`, `${R}/manual-source-transport-amendment1.json`].filter((path, index, all) => all.indexOf(path) === index));
