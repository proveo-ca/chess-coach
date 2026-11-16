// SPEC: _spec/runtime-protocol.puml
import { describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { ROOT, R, equal, sha, validateEligibility } from "../package-acquisition-bun-source2/capture.ts";
import type { EligibilityReader } from "../package-acquisition-bun-source2/capture.ts";
import { validateInvocationReady } from "./invoke-approved-bun.ts";
import { createDeliveryRuntime } from "./delivery-bootstrap.ts";
import { buildLiteralPacket } from "./delivery-packet.ts";
import { renderDelivery } from "./delivery-render.ts";
import { BINDING_PATH, CAPTURE_PROOF, CURRENT_REVIEWS, DELIVERY_SOURCES, FILE_CAP, PACKET_PATH, PROTECTED_ACTUAL_PATHS, PendingReviews, READY_PATH, byteIdentity, prepareCandidate, repositoryReader } from "./seal-ready-packet.ts";
import { observeCurrentGate, offlineSyntheticReader, parseSealTestSummary, preservationState, protectedState } from "./seal-ready-packet-verify.ts";

const api = await createDeliveryRuntime();
const snapshotBefore = protectedState();
const preservationBefore = preservationState();
const deliveryProofPath = process.env["SEAL_SYNTHETIC_DELIVERY_PROOF"];
if (typeof deliveryProofPath !== "string") throw new Error("explicit-frozen-synthetic-delivery-proof-required");
const syntheticProofPath: string = deliveryProofPath;
const synthetic = offlineSyntheticReader(syntheticProofPath);
const candidate = await prepareCandidate(synthetic.reader, CURRENT_REVIEWS);
type Candidate = typeof candidate;
const verifiedCandidate = api.validatePacket(candidate.packet.bytes, candidate.packet.pin, candidate.packet.table);
const fixturePaths = candidate.paths.filter(path => !CURRENT_REVIEWS.includes(path));
const fixturePacket = await buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: fixturePaths }, path => verifiedCandidate.files.get(path)!);
const fixtureCandidate: Candidate = { ...candidate, paths: fixturePaths, packet: fixturePacket };
const deliveryRoles = CURRENT_REVIEWS.slice(8);
const json = (bytes: Buffer) => JSON.parse(bytes.toString()) as Record<string, unknown>;
const encode = (value: unknown) => Buffer.from(JSON.stringify(value));

function mutatedReview(path: string, change: (row: Record<string, unknown>) => void) {
  const fixture = offlineSyntheticReader(syntheticProofPath), row = json(fixture.values.get(path)!);
  change(row); fixture.values.set(path, encode(row)); return fixture;
}
function mutatedProof(change: (row: Record<string, unknown>) => void) {
  const fixture = offlineSyntheticReader(syntheticProofPath), row = json(repositoryReader(syntheticProofPath, FILE_CAP)); change(row);
  const bytes = encode(row); fixture.values.set(syntheticProofPath, bytes);
  for (const path of deliveryRoles) {
    const review = json(fixture.values.get(path)!); review["verificationReceipt"] = { path: syntheticProofPath, sha256: sha(bytes) }; fixture.values.set(path, encode(review));
  }
  return fixture;
}
function packetReader(files: Map<string, Buffer>): EligibilityReader {
  return (path, cap) => { const bytes = files.get(path); if (!bytes || bytes.length > cap) throw new Error("fixture-exact-read-closure"); return Buffer.from(bytes); };
}
function missing(): never { const error = new Error("fixture-absent") as NodeJS.ErrnoException; error.code = "ENOENT"; throw error; }
function fixtureSnapshot(label: string): string {
  const evidence = process.env["SEAL_EVIDENCE_ROOT"];
  if (!evidence || !/^seal-verification-[1-9][0-9]*$/.test(relative(join(ROOT, R), resolve(evidence)))) throw new Error("protected-seal-evidence-root-required");
  return join(evidence, "fixtures", label, "snapshot");
}
function materializeFixture(value: Candidate, root: string): void {
  const rel = relative(join(ROOT, R), resolve(root));
  api.need(/^seal-verification-[1-9][0-9]*\/fixtures\/[A-Za-z0-9_-]+\/snapshot$/.test(rel), "protected-fixture-root-only");
  const verified = api.validatePacket(value.packet.bytes, value.packet.pin, value.packet.table);
  api.need(equal([...verified.files.keys()], fixturePaths) && CURRENT_REVIEWS.every(path => !verified.files.has(path)), "fixture-exact-members-without-synthetic-review-files");
  const read = packetReader(verified.files), identity = validateEligibility(read);
  api.need(equal(identity, value.identity) && equal(validateInvocationReady(identity, read), value.readiness), "fixture-pure-validation-before-first-write");
  const directories = new Set<string>();
  for (const path of verified.files.keys()) for (let parent = dirname(path); parent !== "."; parent = dirname(parent)) directories.add(parent);
  api.need(directories.size <= 256, "fixture-directory-cap");
  api.absent(root);
  const label = dirname(root), fixtureParent = dirname(label);
  try { api.ancestors(fixtureParent); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; api.freshDirectory(fixtureParent); }
  api.freshDirectory(label); api.freshDirectory(root);
  for (const directory of [...directories].sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b))) api.freshDirectory(join(root, directory));
  for (const [path, bytes] of verified.files) api.writeExclusive(join(root, path), bytes, 0o400);
}

describe("offline seal preparation", () => {
  test("actual frozen twelve-role gate validates only in memory", async () => {
    const actual = await observeCurrentGate();
    expect(actual.actualDerivedRecordsWritten).toBe(false);
    expect(actual.status).toBe("ALL_VALID_IN_MEMORY_NOT_EMITTED");
    expect(actual.missing).toEqual([]); expect(actual.absentAtRead).toEqual([]);
    expect(actual.observedRolePins.map(row => row.path)).toEqual([...CURRENT_REVIEWS]);
    if (actual.status !== "ALL_VALID_IN_MEMORY_NOT_EMITTED" || !actual.candidateSummary) throw new Error("actual-frozen-twelve-role-gate-rejected");
    expect(actual.candidateSummary.memberCount).toBe(48); expect(actual.candidateSummary.table.length).toBe(48);
    expect(actual.candidateSummary.candidateBytesPersisted).toBe(false);
    expect(actual.candidateSummary.pureValidation).toEqual({ validateEligibility: "PASS_PURE_INJECTED_READER", validateInvocationReady: "PASS_PURE_INJECTED_READER", validatePacket: "PASS_PURE_IN_MEMORY" });
  });
  test("missing all twelve rejects without source/derived reads", async () => {
    let calls = 0;
    await expect(prepareCandidate(() => { calls++; return missing(); }, CURRENT_REVIEWS)).rejects.toBeInstanceOf(PendingReviews);
    expect(calls).toBe(12);
  });
  for (const paths of [CURRENT_REVIEWS.slice(0, 11), [...CURRENT_REVIEWS, CURRENT_REVIEWS[0]!], [...CURRENT_REVIEWS.slice(0, 11), CURRENT_REVIEWS[0]!], [...CURRENT_REVIEWS].reverse(), ...[2, 3].map(generation => [...CURRENT_REVIEWS.slice(0, 8), ...deliveryRoles.map(path => path.replace("implementation-review-4", `implementation-review-${generation}`))])]) {
    test(`nonliteral/duplicate/extra role set fails before reader: ${paths.length}:${paths.at(-1)}`, async () => {
      let calls = 0; await expect(prepareCandidate(() => { calls++; return missing(); }, paths)).rejects.toThrow("seal-exact-twelve-review-paths"); expect(calls).toBe(0);
    });
  }
  for (const [key, value] of [["status", "NOT_READY_DELIVERY_IMPLEMENTATION_SCOPE"], ["scope", "capture"], ["role", "backend"], ["nonAuthorizing", false], ["executionReadinessClaimed", true], ["trainingReady", true], ["remainingFindings", [{ severity: "LOW" }]], ["reasoningBearingSourceCommentFindings", ["unresolved"]], ["session", ""]] as const) {
    test(`reject review ${key} before binding/ready reads`, async () => {
      const fixture = mutatedReview(deliveryRoles[1]!, row => { row[key] = value; }); const calls: string[] = [];
      await expect(prepareCandidate((path, cap) => { calls.push(path); return fixture.reader(path, cap); }, CURRENT_REVIEWS)).rejects.toThrow();
      expect(calls.every(path => CURRENT_REVIEWS.includes(path))).toBe(true);
      expect(calls).not.toContain(BINDING_PATH); expect(calls).not.toContain(READY_PATH);
    });
  }
  test("synthetic reviews remain nonauthorizing and marked in memory", () => {
    expect([...synthetic.values.keys()]).toEqual([...CURRENT_REVIEWS]);
    for (const bytes of synthetic.values.values()) expect(json(bytes)["syntheticFixtureScope"]).toBe("OFFLINE_SYNTHETIC");
    expect(candidate.scope).toBe("IN_MEMORY_NONAUTHORIZING_CANDIDATE_ONLY");
  });
  for (const key of ["reviewedSource", "verificationReceipt", "sourceManifest"]) {
    test(`wrong review ${key} hash rejects`, async () => {
      const fixture = mutatedReview(deliveryRoles[0]!, row => { const ref = row[key] as Record<string, unknown>; ref["sha256"] = "0".repeat(64); });
      await expect(prepareCandidate(fixture.reader, CURRENT_REVIEWS)).rejects.toThrow();
    });
  }
  test("inconsistent four delivery proof references reject", async () => {
    const fixture = mutatedReview(deliveryRoles[3]!, row => { row["verificationReceipt"] = CAPTURE_PROOF; });
    await expect(prepareCandidate(fixture.reader, CURRENT_REVIEWS)).rejects.toThrow("seal-review-identity-mismatch");
  });
  test("delivery review cannot select historical proof by resolver", async () => {
    const fixture = mutatedReview(deliveryRoles[0]!, row => { row["verificationReceipt"] = { path: `${R}/delivery-verification-latest/receipt.json`, sha256: "0".repeat(64) }; });
    await expect(prepareCandidate(fixture.reader, CURRENT_REVIEWS)).rejects.toThrow("seal-delivery-proof-location");
  });
  for (const [key, value] of [["testsPassed", 0], ["testsPassed", 1.5], ["testsPassed", Number.MAX_SAFE_INTEGER + 1], ["testsFailed", 1], ["status", "PASS"], ["immutableAndHistoricalReadchecksMatch", false], ["sourceUnchanged", false], ["productionRunEntered", true], ["productionTransportInvoked", true], ["realNetworkRequests", 1], ["fishExecuted", true], ["fishNoExecuteChecked", false]] as const) {
    test(`strict delivery proof rejects ${key}=${value}`, async () => {
      const fixture = mutatedProof(row => { row[key] = value; }); await expect(prepareCandidate(fixture.reader, CURRENT_REVIEWS)).rejects.toThrow();
    });
  }
  for (const [key, value] of [["reaped", false], ["outEOF", false], ["errEOF", false], ["cleanupConfirmed", false], ["cleanupExpired", true], ["pipeCleanupFailed", true], ["pipeDestructionAttempted", true], ["exitCode", 1], ["signal", "SIGTERM"], ["pid", 1.5]] as const) {
    test(`delivery command ${key} fails closed`, async () => {
      const fixture = mutatedProof(row => { (row["results"] as Record<string, unknown>[])[0]![key] = value; });
      await expect(prepareCandidate(fixture.reader, CURRENT_REVIEWS)).rejects.toThrow();
    });
  }
  test("duplicate command names fail closed", async () => {
    const fixture = mutatedProof(row => { (row["results"] as Record<string, unknown>[])[2]!["name"] = "typecheck"; });
    await expect(prepareCandidate(fixture.reader, CURRENT_REVIEWS)).rejects.toThrow("seal-delivery-proof-commands");
  });
  test("strict binding and readiness schemas validate actual source bytes through overlays", () => {
    const files = api.validatePacket(candidate.packet.bytes, candidate.packet.pin, candidate.packet.table).files;
    const read = packetReader(files), identity = validateEligibility(read);
    expect(identity).toEqual(candidate.identity); expect(validateInvocationReady(identity, read)).toEqual(candidate.readiness);
    expect(Object.keys(json(candidate.binding)).sort()).toEqual(["version", "grantId", "nonAuthorizing", "sourceHashes", "bindings", "choiceSha256", "verificationReceipt", "reviews"].sort());
    expect(Object.keys(json(candidate.ready)).sort()).toEqual(["version", "nonAuthorizing", "grantId", "hashes", "identitySha256", "invocationProof", "captureProof", "reviews"].sort());
  });
  test("pure preparation never reads actual derived records", () => {
    expect(candidate.inputs.map(row => row.path)).not.toContain(BINDING_PATH); expect(candidate.inputs.map(row => row.path)).not.toContain(READY_PATH); expect(candidate.inputs.map(row => row.path)).not.toContain(PACKET_PATH);
  });
  test("exact 48-member union excludes packet, delivery sources, final evidence, and operational payload", () => {
    expect(candidate.paths.length).toBe(48); expect(new Set(candidate.paths).size).toBe(48);
    expect(candidate.paths).not.toContain(PACKET_PATH);
    for (const path of DELIVERY_SOURCES) expect(candidate.paths).not.toContain(path);
    expect(candidate.paths.filter(path => /(?:^|\/)(?:final-seal[^/]*|seal-verification-[0-9]+|cache|corpus|archives|package-inputs-[12]|acquisition-execution-[0-9]+|acquisition-invocation-[0-9]+)(?:\/|$)/.test(path))).toEqual([]);
  });
  test("each table row binds byte length, SHA256, and Git blob identity", () => {
    const verified = api.validatePacket(candidate.packet.bytes, candidate.packet.pin, candidate.packet.table);
    for (const row of candidate.packet.table) expect({ path: row.path, ...byteIdentity(verified.files.get(row.path)!) }).toEqual(row);
    expect(byteIdentity(candidate.packet.bytes)).toEqual(candidate.packet.pin);
    expect(candidate.packet.bytes.length).toBeLessThanOrEqual(8388608); expect(verified.aggregateBytes).toBeLessThanOrEqual(6291456);
  });
  for (const path of [DELIVERY_SOURCES[0]!, CAPTURE_PROOF.path, `${R}/runtime-eligibility-reads2.json`]) {
    test(`actual source/proof/closure drift rejects: ${path}`, async () => {
      await expect(prepareCandidate((name, cap) => name === path ? Buffer.from("{}") : synthetic.reader(name, cap), CURRENT_REVIEWS)).rejects.toThrow();
    });
  }
  test("malicious reader cannot ignore per-file cap", async () => {
    await expect(prepareCandidate(() => Buffer.alloc(FILE_CAP + 1, 65), CURRENT_REVIEWS)).rejects.toThrow("seal-file-cap");
  });
  test("bounded repository reader rejects traversal and operational roots", () => {
    for (const path of ["../approval2.json", "/etc/passwd", "_work/gpu-owner-recovery/cache/x.json", `${R}/acquisition-execution-1/x.json`, "x//y.json", "x\\y.json"]) expect(() => repositoryReader(path, FILE_CAP)).toThrow();
  });
  test("packet helper rejects file cap before materialization", async () => {
    await expect(buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: candidate.paths }, () => Buffer.alloc(FILE_CAP + 1, 65))).rejects.toThrow("file-byte-cap");
  });
  test("packet helper rejects aggregate source cap", async () => {
    await expect(buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: candidate.paths }, () => Buffer.alloc(FILE_CAP, 65))).rejects.toThrow("aggregate-source-cap");
  });
  test("packet helper rejects excess count before any member read", async () => {
    let calls = 0; await expect(buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: Array.from({ length: 97 }, (_, i) => `f${i}.json`) }, () => { calls++; return Buffer.from("{}"); })).rejects.toThrow("literal-closure-count"); expect(calls).toBe(0);
  });
  test("packet helper rejects binary and duplicate members", async () => {
    await expect(buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: candidate.paths }, () => Buffer.from([0]))).rejects.toThrow("text-only-source");
    await expect(buildLiteralPacket({ scope: "OFFLINE_SYNTHETIC", paths: [candidate.paths[0]!, candidate.paths[0]!] }, () => Buffer.from("{}"))).rejects.toThrow("duplicate-literal-member");
  });
  test("only full-candidate nonrunning Fish syntax fixture renders", async () => {
    const rendered = await renderDelivery({ ...candidate.packet.pin, commitOid: "1".repeat(40), packetPath: PACKET_PATH, fileTable: candidate.packet.table }, "OFFLINE_SYNTHETIC_NONRUNNING");
    expect(rendered.runnableOperatorCommand).toBe(false); expect(rendered.body.split("\n")[1]).toBe("exit 1");
  });
  test("protected fixture materializes exact 36-member review-free packet as 0400 and validates without adapters", () => {
    const root = fixtureSnapshot("exact-members"); materializeFixture(fixtureCandidate, root);
    expect(fixtureCandidate.paths.length).toBe(36);
    const read: EligibilityReader = (path, cap) => {
      api.need(fixtureCandidate.paths.includes(path), "fixture-no-resolver");
      const s = fs.lstatSync(join(root, path)); api.need(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.size <= cap && (s.mode & 0o777) === 0o400, "protected-fixture-regular-0400");
      return fs.readFileSync(join(root, path));
    };
    for (const row of fixtureCandidate.packet.table) expect(byteIdentity(read(row.path, FILE_CAP))).toEqual({ bytes: row.bytes, sha256: row.sha256, gitBlobOid: row.gitBlobOid });
    const identity = validateEligibility(read); expect(identity).toEqual(candidate.identity); expect(validateInvocationReady(identity, read)).toEqual(candidate.readiness);
    expect(fs.existsSync(join(root, PACKET_PATH))).toBe(false);
    for (const path of CURRENT_REVIEWS) expect(fs.existsSync(join(root, path))).toBe(false);
    expect(() => materializeFixture(fixtureCandidate, root)).toThrow("fresh-path-required");
    for (const row of fixtureCandidate.packet.table) expect(sha(read(row.path, FILE_CAP))).toBe(row.sha256);
  });
  test("tampered packet fails pure validation before any fixture mkdir", () => {
    const root = fixtureSnapshot("tampered"); const changed = { ...fixtureCandidate, packet: { ...fixtureCandidate.packet, bytes: Buffer.from("{}") } };
    expect(() => materializeFixture(changed, root)).toThrow(); expect(fs.existsSync(dirname(root))).toBe(false);
  });
  test("fixture materializer rejects real source roots before I/O", () => {
    for (const root of [ROOT, join(ROOT, R), join(ROOT, PROTECTED_ACTUAL_PATHS[0]!, "snapshot")]) expect(() => materializeFixture(candidate, root)).toThrow("protected-fixture-root-only");
  });
  test("real roots, source files, reviews, and derived-record absence remain unchanged", () => {
    expect(protectedState()).toEqual(snapshotBefore);
    expect(preservationState()).toEqual(preservationBefore);
    for (const path of PROTECTED_ACTUAL_PATHS) expect(snapshotBefore[path]?.exists).toBe(false);
  });
});

describe("exact safe-integer verification summary", () => {
  test("accepts one positive pass and one zero fail line", () => { expect(parseSealTestSummary("bun test\n 12 pass\n 0 fail\n")).toEqual({ valid: true, testsPassed: 12, testsFailed: 0 }); });
  for (const label of ["pass case label:", "fail closed parser:", "some pass:", "some pass", "some fail", "1 fail trailing"]) {
    test(`accepts unrelated Bun case label ${JSON.stringify(label)}`, () => { expect(parseSealTestSummary(`${label}\n1 pass\n0 fail\n`)).toEqual({ valid: true, testsPassed: 1, testsFailed: 0 }); });
  }
  for (const value of ["1 pass\n1 pass\n0 fail", "1 pass\n0 fail\n0 fail", "0 pass\n0 fail", "1.5 pass\n0 fail", "01 pass\n0 fail", "+1 pass\n0 fail", "-1 pass\n0 fail", "9007199254740992 pass\n0 fail", "NaN pass\n0 fail", "Infinity pass\n0 fail", "1 pass trailing\n0 fail", "1 pass\n1 fail", "1 pass", "0 fail", "pass 12\n0 fail", "1e2 pass\n0 fail", "1 pass\n0 fail\n1.5 fail", "1 pass\n0 fail\n\u00a01 pass"]) {
    test(`rejects malformed/duplicate summary ${JSON.stringify(value)}`, () => { expect(parseSealTestSummary(value).valid).toBe(false); });
  }
});
