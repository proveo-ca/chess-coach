// SPEC: _spec/runtime-protocol.puml
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { constants, existsSync, readFileSync } from "node:fs";
import { join, posix, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DIRECTORY_FLAGS, FIXED_ANCESTORS, FIXED_CACHE_PARENT, FIXED_CONTAINER, ROOT, prepareFixedCacheParent } from "./cache-parent.ts";
import type { CacheParentIO, DirectoryIdentity, ExistingLocalDeadline } from "./cache-parent.ts";

const D = "_work/gpu-owner-recovery/runs/host-canonical-r4-source-1/offline-reference-proposal-1";
const R1 = `${D}/package-acquisition-proposal-1`, R2 = `${D}/package-acquisition-proposal-2`;
const S2 = `${D}/package-acquisition-bun-source2`;
function errno(code: string): Error { return Object.assign(new Error(code), { code }); }
function directory(ino: number): DirectoryIdentity { return { kind: "directory", dev: 1n, ino: BigInt(ino) }; }
class LocalDeadline implements ExistingLocalDeadline {
  checks = 0;
  failAt = Infinity;
  failure: "throw" | "expire" | "regress" = "throw";
  assertActive(): void {
    this.checks++;
    if (this.checks >= this.failAt) throw new Error(this.failure === "throw" ? "clock-read-failed" : this.failure === "expire" ? "absolute-deadline" : "clock-invalid-or-regressed");
  }
}
class MemoryIO implements CacheParentIO {
  readonly nodes = new Map<string, DirectoryIdentity>(FIXED_ANCESTORS.map((path, i) => [path, directory(i + 1)]));
  readonly trace: { operation: string; path: string | number; options?: unknown }[] = [];
  readonly handles = new Map<number, DirectoryIdentity>();
  readonly opened: number[] = [];
  readonly closed: number[] = [];
  claimed = true;
  eligible = true;
  consumed = 1;
  failOperationAt = Infinity;
  mkdirCollision = false;
  fstatKind: DirectoryIdentity["kind"] = "directory";
  fstatDrift = false;
  nextFd = 100;
  boundDeadline: ExistingLocalDeadline;
  constructor(deadline: ExistingLocalDeadline, existing = false) {
    this.boundDeadline = deadline;
    if (existing) this.nodes.set(FIXED_CACHE_PARENT, directory(90));
  }
  assertClaimedContext(deadline: ExistingLocalDeadline): void {
    if (!this.eligible || !this.claimed || this.consumed !== 1 || deadline !== this.boundDeadline) throw new Error("new-exclusive-claimed-context-required");
  }
  record(operation: string, path: string | number, options?: unknown): void {
    this.trace.push({ operation, path, ...(options === undefined ? {} : { options }) });
    if (this.trace.length === this.failOperationAt) throw new Error(`injected-${operation}`);
  }
  lstat(path: Parameters<CacheParentIO["lstat"]>[0]): DirectoryIdentity {
    this.record("lstat", path);
    const value = this.nodes.get(path);
    if (!value) throw errno("ENOENT");
    return { ...value };
  }
  mkdirCacheParent(path: typeof FIXED_CACHE_PARENT, options: { mode: 0o700; recursive: false }): void {
    this.record("mkdir", path, options);
    assert.equal(path, FIXED_CACHE_PARENT);
    assert.deepEqual(options, { mode: 0o700, recursive: false });
    if (this.mkdirCollision) this.nodes.set(path, directory(99));
    if (this.nodes.has(path)) throw errno("EEXIST");
    this.nodes.set(path, directory(100));
  }
  openDirectory(path: Parameters<CacheParentIO["openDirectory"]>[0], flags: number): number {
    this.record("open", path, flags);
    assert.equal(flags, DIRECTORY_FLAGS);
    const node = this.nodes.get(path);
    if (!node || node.kind !== "directory") throw errno("ENOTDIR");
    const fd = this.nextFd++;
    this.handles.set(fd, { ...node }); this.opened.push(fd);
    return fd;
  }
  fstat(fd: number): DirectoryIdentity {
    this.record("fstat", fd);
    const identity = this.handles.get(fd);
    if (!identity) throw errno("EBADF");
    return { ...identity, kind: this.fstatKind, ino: identity.ino + (this.fstatDrift ? 1n : 0n) };
  }
  fsync(fd: number): void {
    this.record("fsync", fd);
    if (!this.handles.has(fd)) throw errno("EBADF");
  }
  close(fd: number): void {
    this.closed.push(fd); this.handles.delete(fd);
    this.record("close", fd);
  }
}
function fixture(existing = false): { io: MemoryIO; deadline: LocalDeadline } {
  const deadline = new LocalDeadline();
  return { io: new MemoryIO(deadline, existing), deadline };
}
function allClosesAttempted(io: MemoryIO): void {
  assert.deepEqual([...io.closed].sort(), [...io.opened].sort());
  assert.equal(new Set(io.closed).size, io.closed.length);
}
function messages(error: unknown): string {
  return error instanceof AggregateError ? error.errors.map(messages).join(" ") : error instanceof Error ? error.message : String(error);
}
async function rejection(io: MemoryIO, deadline: LocalDeadline, message?: string): Promise<void> {
  let caught: unknown;
  try { await prepareFixedCacheParent(io, deadline); } catch (error) { caught = error; }
  assert.notEqual(caught, undefined);
  if (message) assert.ok(messages(caught).includes(message));
  allClosesAttempted(io);
}

describe("isolated fixed-parent preparation with in-memory IO only", () => {
  test("reproduces missing common parent and creates only that leaf after mock claim", async () => {
    const { io, deadline } = fixture();
    assert.equal(io.nodes.has(FIXED_CACHE_PARENT), false);
    assert.equal(await prepareFixedCacheParent(io, deadline), "CREATED");
    assert.deepEqual(io.trace.filter(row => row.operation === "mkdir"), [{ operation: "mkdir", path: FIXED_CACHE_PARENT, options: { mode: 0o700, recursive: false } }]);
    assert.deepEqual(io.trace.filter(row => row.operation === "fsync").map(row => row.path), [101, 100]);
    assert.deepEqual(io.closed, [101, 100]);
    assert.equal(io.nodes.size, FIXED_ANCESTORS.length + 1);
    assert.equal(deadline.checks, 41);
    allClosesAttempted(io);
  });
  test("accepts an existing valid directory without writes, enumeration, chmod, or payload reads", async () => {
    const { io, deadline } = fixture(true);
    const original = io.nodes.get(FIXED_CACHE_PARENT);
    assert.equal(await prepareFixedCacheParent(io, deadline), "EXISTING_DIRECTORY");
    assert.equal(io.trace.every(row => ["lstat", "open", "fstat", "close"].includes(row.operation)), true);
    assert.equal(io.nodes.get(FIXED_CACHE_PARENT), original);
    assert.equal(deadline.checks, 27);
    allClosesAttempted(io);
  });
  for (const kind of ["symlink", "other"] as const) {
    test(`rejects ${kind} at the fixed leaf`, async () => {
      const { io, deadline } = fixture(true);
      io.nodes.set(FIXED_CACHE_PARENT, { ...directory(90), kind });
      await rejection(io, deadline, "not-nonsymlink-directory");
      assert.equal(io.trace.some(row => row.operation === "mkdir"), false);
    });
    for (const ancestor of FIXED_ANCESTORS) {
      test(`rejects ${kind} ancestor ${ancestor}`, async () => {
        const { io, deadline } = fixture();
        io.nodes.set(ancestor, { ...directory(1), kind });
        await rejection(io, deadline, "not-nonsymlink-directory");
        assert.equal(io.trace.some(row => row.operation === "mkdir"), false);
      });
    }
  }
  for (const ancestor of FIXED_ANCESTORS) {
    test(`never recursively creates missing ancestor ${ancestor}`, async () => {
      const { io, deadline } = fixture(); io.nodes.delete(ancestor);
      await rejection(io, deadline, "ENOENT");
      assert.equal(io.trace.some(row => row.operation === "mkdir"), false);
    });
  }
  test("exclusive mkdir collision fails without adopting or deleting the raced directory", async () => {
    const { io, deadline } = fixture(); io.mkdirCollision = true;
    await rejection(io, deadline, "EEXIST");
    assert.equal(io.nodes.get(FIXED_CACHE_PARENT)?.ino, 99n);
    assert.deepEqual(io.opened, [100]);
    assert.equal(io.consumed, 1);
  });
  test("uses O_NOFOLLOW and O_DIRECTORY on both directory descriptors", async () => {
    const { io, deadline } = fixture(); await prepareFixedCacheParent(io, deadline);
    assert.deepEqual(io.trace.filter(row => row.operation === "open"), [
      { operation: "open", path: FIXED_CONTAINER, options: DIRECTORY_FLAGS },
      { operation: "open", path: FIXED_CACHE_PARENT, options: DIRECTORY_FLAGS }
    ]);
    assert.notEqual(DIRECTORY_FLAGS & constants.O_NOFOLLOW, 0);
    assert.notEqual(DIRECTORY_FLAGS & constants.O_DIRECTORY, 0);
  });
  for (const existing of [false, true]) {
    for (const kind of ["symlink", "other"] as const) {
      test(`fstat rejects ${kind}, existing=${existing}`, async () => {
        const { io, deadline } = fixture(existing); io.fstatKind = kind;
        await rejection(io, deadline, "not-nonsymlink-directory");
      });
    }
    test(`fstat rejects identity replacement, existing=${existing}`, async () => {
      const { io, deadline } = fixture(existing); io.fstatDrift = true;
      await rejection(io, deadline, "identity-drift");
    });
  }
  for (let operation = 1; operation <= 19; operation++) {
    test(`IO failure at missing-parent operation ${operation} closes every acquired descriptor`, async () => {
      const { io, deadline } = fixture(); io.failOperationAt = operation;
      await rejection(io, deadline, "injected-");
      assert.equal(io.consumed, 1);
      if (operation > 12) assert.equal(io.nodes.has(FIXED_CACHE_PARENT), true);
    });
  }
  for (const failure of ["throw", "expire", "regress"] as const) {
    for (let point = 1; point <= 41; point++) {
      test(`${failure} deadline at check ${point} preserves partials and still attempts all closes`, async () => {
        const { io, deadline } = fixture(); deadline.failAt = point; deadline.failure = failure;
        await rejection(io, deadline);
        assert.equal(io.consumed, 1);
        if (io.trace.some(row => row.operation === "mkdir")) assert.equal(io.nodes.has(FIXED_CACHE_PARENT), true);
      });
    }
  }
  test("clock failure plus close failure still closes the other descriptor", async () => {
    const { io, deadline } = fixture(); deadline.failAt = 36; io.failOperationAt = 18;
    await rejection(io, deadline, "clock-read-failed");
    assert.deepEqual(io.closed, [101, 100]);
    assert.equal(io.nodes.has(FIXED_CACHE_PARENT), true);
  });
  for (const reason of ["unclaimed", "ineligible", "wrong-deadline", "unconsumed"]) {
    test(`${reason} rejects before any filesystem operation`, async () => {
      const { io, deadline } = fixture();
      if (reason === "unclaimed") { io.claimed = false; io.consumed = 0; }
      if (reason === "ineligible") io.eligible = false;
      if (reason === "wrong-deadline") io.boundDeadline = new LocalDeadline();
      if (reason === "unconsumed") io.consumed = 0;
      await rejection(io, deadline, "claimed-context-required");
      assert.deepEqual(io.trace, []);
      assert.equal(io.nodes.has(FIXED_CACHE_PARENT), false);
    });
  }
  test("mock eligibility failure before exclusive claim consumes nothing and creates nothing", async () => {
    const { io, deadline } = fixture(); io.claimed = false; io.eligible = false; io.consumed = 0;
    await rejection(io, deadline, "claimed-context-required");
    assert.equal(io.consumed, 0); assert.deepEqual(io.trace, []);
  });
  test("post-claim mock failure remains spent and cannot imply a retry grant", async () => {
    const { io, deadline } = fixture(); io.failOperationAt = 16;
    await rejection(io, deadline, "injected-fsync");
    assert.equal(io.consumed, 1);
    assert.equal(io.nodes.has(FIXED_CACHE_PARENT), true);
    assert.equal(io.trace.some(row => !["lstat", "mkdir", "open", "fstat", "fsync", "close"].includes(row.operation)), false);
  });
});

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("record-required");
  return value as RecordValue;
}
function json(relative: string): RecordValue { return record(JSON.parse(readFileSync(join(ROOT, relative), "utf8"))); }
function copy(value: RecordValue): RecordValue { return record(JSON.parse(JSON.stringify(value))); }
function same(actual: unknown, expected: unknown): void { assert.deepEqual(actual, expected); }
const request = json(`${R2}/request.json`), plan = json(`${R2}/plan.json`);
const oldRequest = json(`${R1}/request.json`), oldPlan = json(`${R1}/plan.json`);
const roots = [
  `${R2}/acquisition-invocation-1`, `${R2}/acquisition-execution-1`, "_work/gpu-owner-recovery/cache",
  "_work/gpu-owner-recovery/cache/reference-package-inputs-2", `${D}/package-inputs-2`, `${D}/package-inputs-2/files`
];
function validatePreparationContract(r: RecordValue, p: RecordValue, existingRoots: string[] = []): void {
  same(r["id"], "reference-two-package-source-acquisition-2"); same(r["proposedGrant"], r["id"]); same(p["proposedGrant"], r["id"]);
  same(r["status"], "UNAPPROVED_NETWORK_0_AUTHORIZED_ATTEMPTS_0"); same(p["status"], "OFFLINE_PREPARATION_ONLY_NOT_EXECUTABLE");
  same(r["preparationOnly"], true); same(r["plan"], `${R2}/plan.json`);
  same(r["requestedOperations"], oldRequest["requestedOperations"]);
  same(r["requestedLimits"], oldRequest["requestedLimits"]); same(p["limits"], oldRequest["requestedLimits"]);
  same(p["archives"], oldPlan["archives"]); same(p["lockSource"], oldPlan["lockSource"]); same(p["reference"], oldPlan["reference"]);
  same(record(p["lockSource"])["sha256"], "1d05ed3d8de5a94873f26a2fb51b88c080704d2e90bf942f9f0bb2ce75a504e0");
  for (const key of ["newAcquisitionGrantIssued", "networkAcquisitionApproved", "selectedArchiveExtractionApproved", "productionCacheParentCreationApproved", "productionDestinationPreparationApproved", "automaticRetryAuthorized", "redirectsAuthorized", "headOrRegistryMetadataQueriesAuthorized", "credentialsCookiesOrNpmrcAuthorized", "proxiesAuthorized", "packageInstallationAuthorized", "packageCodeExecutionAuthorized", "referenceBundlingApproved", "hostAssemblyOrExecutionApproved", "nativeOrGpuExecutionApproved", "actualCommitOrPushApproved", "publicationApproved", "experimentTrainingApproved", "failedFull1CacheOrHaltedLlvmPipelineUseAuthorized", "executionReadinessClaimed", "trainingReady"]) same(r[key], false);
  for (const key of ["currentLiveGrant", "currentAuthorizedAcquisitionAttempts", "networkOperationsPerformed"]) same(r[key], 0);
  for (const key of ["networkOperationsPerformed", "archiveExtractionsPerformed", "currentLiveGrant", "packageManagerOrInstallerInvocations"]) same(p[key], 0);
  for (const key of ["productionCacheParentCreated", "productionDestinationsCreated", "newAcquisitionGrantIssued", "newResolverOrAuthorizationFrameworkProposed", "executionReadinessClaimed", "trainingReady", "f64FloatmathSourceRuntimeInterfacesChanged"]) same(p[key], false);
  same(record(r["oldGrant"]), { id: "reference-two-package-source-acquisition-1", state: "SPENT", combinedAttemptsConsumed: 1, actualGetRequests: 0, remainingAuthorizedCombinedAttempts: 0, remainingAuthorizedGetRequests: 0, unusedUrlSlots: 2, unusedUrlSlotsAreAuthority: false });
  same(r["requestedFixedCommonParentCreation"], { path: "_work/gpu-owner-recovery/cache", onlyIfAbsent: true, afterNewExclusiveCombinedClaimOnly: true, mode: "0700", recursive: false, existingValidDirectoryAccepted: true, enumerationAuthorized: false, existingDirectoryChmodAuthorized: false, deletionAuthorized: false, requestIsAuthority: false });
  const creations = p["finiteFutureDirectoryCreations"];
  if (!Array.isArray(creations)) throw new Error("finite-creations-required");
  same(creations.map(value => record(value)["path"]), roots);
  same(creations.map(value => record(value)["role"]), ["observer", "operation", "commonParent", "raw", "output", "files"]);
  same(creations.map(value => record(value)["mustBeFresh"]), [true, true, false, true, true, true]);
  same(creations.map(value => record(value)["phase"]), ["OUTER_READ_ONLY_ELIGIBILITY_PASSED_BEFORE_CAPTURE_RUNS", "SUPERVISOR_ELIGIBILITY_PASSED_NEW_EXCLUSIVE_COMBINED_CLAIM", "CLAIMED_OPERATIONAL_PREFLIGHT", "AFTER_FIXED_PARENT_PREPARATION", "AFTER_FIXED_PARENT_PREPARATION", "AFTER_NEW_OUTPUT_ROOT"]);
  same(new Set(creations.map(value => record(value)["path"])).size, 6);
  same(p["commonCacheParent"], roots[2]); same(p["archiveRoot"], roots[3]); same(p["selectedOutputRoot"], roots[4]); same(p["selectedSourcesRoot"], roots[5]);
  same(p["observerRoot"], roots[0]); same(p["operationRoot"], roots[1]); same(p["sourceRoot"], S2);
  same(p["futureActualApprovalPath"], `${R2}/approval2.json`); same(p["futureExecutionBindingPath"], `${S2}/execution-binding2.json`);
  const archives = oldPlan["archives"] as unknown[];
  same(p["futureArtifactFileMap"], {
    operation: ["attempt.json", "events.jsonl", "consumption-receipt.json"],
    observer: ["observation.json", "command.stdout", "command.stderr"],
    raw: archives.map(value => record(value)["archiveFile"]), output: ["selected-input-manifest.json"],
    selected: archives.flatMap(value => {
      const archive = record(value);
      return [...(archive["requiredMembers"] as unknown[]).map(member => record(member)["retainedFile"]),
        ...(archive["optionalLicenseMembersInPreferenceOrder"] as string[]).map(member => String(archive["licenseRetainedFilePrefix"]) + member.split("/").at(-1))];
    }), maximumOptionalLicenseFilesPerArchive: 1, maximumSelectedFiles: 6
  });
  const integration = record(p["integrationDelta"]);
  same(integration["mockPhaseGuardIsNotFullIntegrationQualification"], true);
  same(integration["existingTimingUnchanged"], { outerMs: 120000, supervisorOperationMs: 120000, supervisorWorkMs: 108000, getMs: 30000, includes: ["offline eligibility", "startup", "fixed-parent preparation", "worker", "finalization", "cleanup"], clockProtocol: "PROCESS_LOCAL_DOMAINS_WITH_CONSERVATIVE_DURATION_HANDSHAKES", strictOsSchedulingOrDurabilityDeadlineGuarantee: false });
  for (const path of existingRoots) if (path !== roots[2] && roots.includes(path)) throw new Error("fresh-root-collision-or-replay");
  same(p["freshnessContract"], { rootsMayNotCollide: true, rejectReplayOrExistingNewRoots: true, reuseOrAdoptionOfR1Roots: false, commonParentOnlyExistingDirectoryException: true, noOldCacheEnumerationOrPayloadReads: true });
}
describe("offline request/plan contract checks, not executable eligibility", () => {
  test("fresh JSON serialization/reparse retains the entire persisted request and plan", () => {
    same(copy(request), request); same(copy(plan), plan);
    validatePreparationContract(copy(request), copy(plan));
  });
  test("exact two URLs, SRIs, versions, members, limits, and lock stay equal to immutable R1", () => {
    same(plan["archives"], oldPlan["archives"]); same(request["requestedLimits"], oldRequest["requestedLimits"]);
    same(request["requestedOperations"], { combinedAcquisitionAttempts: 1, httpGets: 2, getsPerUrl: 1, selectedArchiveExtractions: 2 });
    validatePreparationContract(request, plan);
  });
  for (const field of ["bytesPerArchive", "aggregateArchiveBytes", "perGetMs", "operationMs", "decompressedBytesPerArchiveIncludingSkippedContent", "tarHeadersPerArchiveIncludingMetadata", "aggregateSelectedOutputBytes", "selectedFiles"]) {
    for (const delta of [-1, 1]) {
      test(`rejects requested limit mutation ${field} ${delta}`, () => {
        const r = copy(request), limits = record(r["requestedLimits"]); limits[field] = Number(limits[field]) + delta;
        assert.throws(() => validatePreparationContract(r, plan));
      });
    }
  }
  for (const field of ["url", "integrity", "version", "requiredMembers", "optionalLicenseMembersInPreferenceOrder"]) {
    test(`rejects archive ${field} mutation`, () => {
      const p = copy(plan), archives = p["archives"] as unknown[];
      record(archives[0])[field] = "MUTATED";
      assert.throws(() => validatePreparationContract(request, p));
    });
  }
  for (const role of ["observerRoot", "operationRoot", "archiveRoot", "selectedOutputRoot", "selectedSourcesRoot"]) {
    test(`rejects R1 reuse via ${role}`, () => {
      const p = copy(plan); p[role] = String(p[role]).replace(/-2(?=\/|$)/g, "-1");
      assert.throws(() => validatePreparationContract(request, p));
    });
  }
  for (const path of roots.filter(path => path !== "_work/gpu-owner-recovery/cache")) {
    test(`rejects fresh-root collision/replay ${path}`, () => {
      assert.throws(() => validatePreparationContract(request, plan, [path]), /collision-or-replay/);
    });
  }
  test("only the common-parent directory has an existing-directory exception", () => {
    validatePreparationContract(request, plan, ["_work/gpu-owner-recovery/cache"]);
  });
  test("rejects root-map collisions and expanded directory-creation scope", () => {
    const p = copy(plan), creations = p["finiteFutureDirectoryCreations"] as unknown[];
    record(creations[3])["path"] = roots[4];
    assert.throws(() => validatePreparationContract(request, p));
    creations.push({ role: "extra", path: `${D}/extra`, mustBeFresh: true });
    assert.throws(() => validatePreparationContract(request, p));
  });
  test("rejects an unlisted future output artifact or missing selected-input manifest", () => {
    const p = copy(plan), files = record(p["futureArtifactFileMap"]);
    files["output"] = ["unexpected.json"];
    assert.throws(() => validatePreparationContract(request, p));
  });
  test("rejects moving cache-parent preparation before the new exclusive claim", () => {
    const p = copy(plan), creations = p["finiteFutureDirectoryCreations"] as unknown[];
    record(creations[2])["phase"] = "BEFORE_NEW_CLAIM";
    assert.throws(() => validatePreparationContract(request, p));
  });
  for (const field of ["networkAcquisitionApproved", "productionCacheParentCreationApproved", "automaticRetryAuthorized", "newAcquisitionGrantIssued"]) {
    test(`rejects an authority widening in ${field}`, () => {
      const r = copy(request); r[field] = true;
      assert.throws(() => validatePreparationContract(r, plan));
    });
  }
  test("unused old URL slots cannot authorize a new combined attempt", () => {
    const r = copy(request); record(r["oldGrant"])["unusedUrlSlotsAreAuthority"] = true;
    assert.throws(() => validatePreparationContract(r, plan));
  });
  test("missing actual approval cannot yield an executable packet because full integration is absent", () => {
    for (const relative of [`${R2}/approval1.json`, `${R2}/approval2.json`, `${R2}/invoke-approved-bun.ts`, `${R2}/invocation-ready1.json`, `${R2}/invocation-ready2.json`, `${S2}/capture.ts`, `${S2}/caller.ts`, `${S2}/execution-binding1.json`, `${S2}/execution-binding2.json`]) assert.equal(existsSync(join(ROOT, relative)), false);
    same(request["currentAuthorizedAcquisitionAttempts"], 0); same(request["newAcquisitionGrantIssued"], false);
    same(plan["executionReadinessClaimed"], false);
    const source = readFileSync(join(ROOT, S2, "cache-parent.ts"), "utf8");
    assert.doesNotMatch(source, /(?:process\.argv|import\.meta|mkdirSync|spawn\(|fetch\(|https|validateEligibility|approvalSha)/);
    validatePreparationContract(request, plan);
  });
});

const MANUAL_REQUEST = `${R2}/manual-handoff-request1.json`, MANUAL_PLAN = `${R2}/manual-handoff-plan1.json`;
const manualRequest = json(MANUAL_REQUEST), manualPlan = json(MANUAL_PLAN);
const HANDOFF = `${ROOT}/_work/gpu-owner-recovery/runs/reference-package-handoff-2`, SNAPSHOT = `${HANDOFF}/snapshot`;
const IMMUTABLE_INPUTS = {
  request: { path: `${R2}/request.json`, sha256: "c0288e1e34e24d2f7a81e12ee1967ffafbd2768b4c2a5bc2ba15826b6384ff3f" },
  plan: { path: `${R2}/plan.json`, sha256: "7f6a90ca105d6a7c5a45951b508d4a1ecdd5e217625d1cefe08da23557847405" }
};
const MANUAL_ROOTS = {
  HOSTROOT: ROOT, READ_ROOT: SNAPSHOT, OP_ROOT: ROOT, H: HANDOFF, SNAPSHOT, EVIDENCE: `${HANDOFF}/evidence`,
  OUTER_OBSERVER: `${SNAPSHOT}/${R2}/acquisition-invocation-1`, CAPTURE_OP2: `${ROOT}/${R2}/acquisition-execution-1`,
  CACHE_COMMON_PARENT: FIXED_CACHE_PARENT, RAW2: `${ROOT}/_work/gpu-owner-recovery/cache/reference-package-inputs-2`,
  OUTPUT2: `${ROOT}/${D}/package-inputs-2`, OUTPUT_FILES2: `${ROOT}/${D}/package-inputs-2/files`
};
const ENVELOPE_CAPS = { maximumFiles: 96, maximumBytesPerFile: 1048576, maximumAggregateSourceBytes: 6291456, maximumDecodedPacketBytes: 8388608, maximumGitHubApiResponseBytes: 12582912, maximumSnapshotDirectories: 256, githubFetchRequests: 1, githubFetchMs: 30000, textFilesOnly: true };
const HELPER_PINS = [
  { path: "_work/gpu-owner-recovery/verify.ts", bytes: 12723, sha256: "9831b75035a5d832c6d86608b7d561821ee1a4c6dec8d2a7ecd31fbca55d5f58" },
  { path: "_work/gpu-owner-recovery/command-supervisor.ts", bytes: 910, sha256: "88e56077c3bcddf722f81081a0cb7c6f94d1da106add486dbf13a92d165fb9c6" }
];
const HOST_OPERATION_PARENTS = [`${ROOT}/_work/gpu-owner-recovery/runs/host-canonical-r4-source-1`, `${ROOT}/${D}`, `${ROOT}/${R2}`];
function hash(bytes: Uint8Array): string { return createHash("sha256").update(bytes).digest("hex"); }
function validateManualContract(r: RecordValue, p: RecordValue): void {
  for (const value of [r, p]) {
    same(value["id"], "reference-package-manual-host-handoff-2");
    same(value["status"], "UNAPPROVED_COMPOSITE_MANUAL_AND_ACQUISITION_SCOPE");
    same(value["preparationOnly"], true); same(value["architectAcceptedSession"], "ses_e2f47580affedkCSE0PvqFHby6");
    same(value["immutableAcquisitionInputs"], IMMUTABLE_INPUTS);
    same(value["currentLiveAcquisitionGrant"], 0); same(value["newGrantIssued"], false);
    same(value["executionReadinessClaimed"], false); same(value["trainingReady"], false);
  }
  for (const binding of Object.values(IMMUTABLE_INPUTS)) same(hash(readFileSync(join(ROOT, binding.path))), binding.sha256);
  same(r["manualPlan"], MANUAL_PLAN); same(p["manualRequest"], MANUAL_REQUEST);
  same(r["proposedInnerGrant"], "reference-two-package-source-acquisition-2");
  same(r["requestedOperations"], { manualHostHandoffAttempts: 1, githubSourcePacketFetchRequests: 1, innerCombinedAcquisitionAttempts: 1, innerNpmGets: 2, innerGetsPerUrl: 1, containerInvocations: 0 });
  same(r["requestedTiming"], { sourceTransferAndMaterializationMs: 120000, sourceGitHubFetchMs: 30000, acquisitionOperationMs: 120000, globalManualDeadlineMs: null, nominalSequentialStageSumMs: 240000, nominalSumIsUnconditionalWholeScriptBound: false, stageBudgetsAreSequentialAndDistinct: true, resetInsideAcquisitionAuthorized: false, stageToolStartupAndCleanupIncluded: true, newWholeScriptCancellationAuthorized: false });
  same(r["requestedSourceEnvelope"], { ...ENVELOPE_CAPS, literalFiniteFileTableRequired: true, verifyLengthSha256AndCommittedGitBlobIdentityBeforeMaterialization: true });
  same(r["requestedHostRoot"], ROOT);
  same(r["requestedGitHubSource"], { scheme: "https", hostname: "github.com", repository: "proveo-ca/chess-coach", existingHostGhConfigurationOnly: true, loginOrNewSecretsAuthorized: false, credentialConfigWritesAuthorized: false, credentialPrintingAuthorized: false });
  same(r["requestedDirectoryPolicy"], { requiredAncestorsAlreadyExist: true, handoffRootExclusiveClaimFirst: true, hostOperationParentsOnlyAsEnumeratedInManualPlan: true, snapshotAndEvidenceMustBeFresh: true, snapshotObserverIsOnlyExplicitWritableSubtree: true, cacheParentOnlyAfterNewInnerClaim: true, recursiveAncestorRepairAuthorized: false, overwriteAdoptionSubstitutionFallbackRetriesOrDeletionAuthorized: false });
  same(r["requiredCompositeApproval"], {
    path: `${R2}/approval2.json`, mustBeFreshActualApproval: true,
    requiredRecordHashBindingPaths: [`${R2}/request.json`, `${R2}/plan.json`, MANUAL_REQUEST, MANUAL_PLAN],
    manualRecordHashesMustBeComputedFromActualBytes: true, realApprovalSha256MustBePinnedInFutureFullSource: true,
    placeholderApprovalFilesOrHashesAuthorized: false, publicationSelectionIsApproval: false, thisRequestIsApproval: false
  });
  same(r["publicationContext"], { selection: `${D}/ready-retry-publication-selection1.json`, conditionalMaximumNormalCommits: 1, conditionalMaximumHttpsPushes: 1, afterFreshActualApprovalFullImplementationAndReviewsOnly: true, selectionGrantsManualSourceFetchRegistryOrCacheAuthority: false, publishDuringThisPreparation: false, manualFishCommandOnlyAfterSuccessfulPublication: true, assistantMayExecuteManualCommand: false });
  same(r["oldGrant"], { id: "reference-two-package-source-acquisition-1", state: "SPENT", remainingAuthorizedCombinedAttempts: 0, remainingAuthorizedGetRequests: 0, unusedUrlSlotsAreAuthority: false });
  for (const key of ["currentAuthorizedManualHandoffAttempts", "actualNetworkRequests", "actualManualHandoffs"]) same(r[key], 0);
  for (const key of ["actualCompositeApprovalExists", "manualHandoffApproved", "githubSourceFetchApproved", "registryAcquisitionApproved", "productionCacheOrDestinationCreationApproved", "hostNativeGpuAssemblyOrTrainingApproved", "targetAvailabilityVerified", "sourceFileTableFrozen", "fullImplementationPresent"]) same(r[key], false);
  same(p["rootMatrix"], MANUAL_ROOTS);
  same(p["addendumPrecedence"], { originalRequestAndPlanRemainByteImmutable: true, observerRootRelativePathUnchanged: true, observerRootBaseInManualContext: "SNAPSHOT", sourceAndEligibilityReadBase: "SNAPSHOT", captureOperationBase: "HOSTROOT", clarifiesManualRootAndTimingContextOnly: true, weakensSourceOrApprovalEligibility: false, changesNpmArchiveUrlsSriMembersOrCaps: false, changesF64FloatmathSourceRuntimeOrInterfaces: false });
  same(p["targetPreconditions"], { requiredRoot: ROOT, requiredRunsAncestor: `${ROOT}/_work/gpu-owner-recovery/runs`, allAncestorsMustAlreadyBeNonsymlinkDirectories: true, requiredInstalledTools: ["mise", "core:bun@1.4.0", "gh"], failWithoutRepairOrInstall: true, targetAvailabilityVerifiedByThisPreparation: false, availabilityClaimBeyondExistingFunctionalReports: false, hostCheckoutMustRemainUnchanged: true, oldRustGpuHostContainerRestrictionsUnchanged: true, noOriginalHostCustodyGateReopened: true });
  same(p["toolContract"], {
    bun: { existingMiseTool: "core:bun@1.4.0", version: "1.4.0", autoInstall: false, taskRunAutoInstall: false, childExecutable: "CURRENT_RUNNING_VERSION_CHECKED_PROCESS_EXECPATH", sameExecutableForAllBunChildren: true, arbitraryExecutableOverride: false, assumeHostUsrLocalBinBun: false, flags: ["--no-env-file", "--no-install"] },
    github: { tool: "gh", scheme: "https", hostname: "github.com", repository: "proveo-ca/chess-coach", fetchRequests: 1, existingHostCredentialConfigurationOnlyAfterCompositeApproval: true, loginOrNewSecrets: false, configurationWrites: false, credentialPrinting: false, redirectsRetriesOrFallback: false },
    registryWorker: { minimalEnvironment: true, ghCredentials: false, npmrc: false, cookies: false, proxies: false, packageInstallationOrExecution: false },
    containerDockerNativeRequiredForJsAcquisition: false, containerInvocations: 0, gitPullCheckoutMergeCherryPickHooksOrOriginalFeatureBranchIntegration: false, newResolverAuthorizationOrCancellationFramework: false
  });
  same(p["stageBudgets"], {
    sourceTransferAndMaterializationMs: 120000, sourceGitHubFetchMs: 30000, acquisitionOperationMs: 120000, globalManualDeadlineMs: null,
    nominalSequentialStageSumMs: 240000, nominalSumIsUnconditionalWholeScriptBound: false, sequentialDistinctBudgets: true,
    stageAToolStartupPreflightMaterializationAndOwnedCleanupIncluded: true, stageBAcquisitionEligibilityStartupFinalizationAndOwnedCleanupIncluded: true,
    stageASealedAndGithubChildrenFinishedBeforeStageB: true, acquisitionWorkerExistsDuringStageA: false, acquisitionDeadlineResetAllowed: false,
    newWholeScriptCancellationAllowed: false, existingOwnedChildCleanupMustComplete: true,
    innerTimingUnchanged: { outerMs: 120000, supervisorOperationMs: 120000, supervisorWorkMs: 108000, getMs: 30000, clockProtocol: "PROCESS_LOCAL_DOMAINS_WITH_CONSERVATIVE_DURATION_HANDSHAKES", strictOsSchedulingOrDurabilityDeadlineGuarantee: false }
  });
  same(p["attemptAccounting"], { handoffId: "reference-package-manual-host-handoff-2", maximumHandoffAttempts: 1, innerGrantId: "reference-two-package-source-acquisition-2", maximumInnerCombinedAttempts: 1, maximumNpmGets: 2, maximumNpmGetsPerUrl: 1, handoffConsumedByExclusiveHClaim: true, innerConsumedOnlyByExclusiveCaptureOp2Claim: true, failedHandoffRestoresInnerAllowance: false, failedHandoffDeliberatelyConsumesUnclaimedInnerAllowance: false, automaticRetry: false, oldSpentGrantOrUnusedUrlSlotsReusable: false, preservePartialsAndStop: true });
  same(p["sourceTransferEnvelope"], {
    ...ENVELOPE_CAPS, tableKind: "FIXED_LITERAL_TEXT_FILE_TABLE_NOT_A_RESOLVER", literalFileTablePresent: false,
    freezeActualClosureOnlyAfterFreshActualApprovalFullImplementationAndReviews: true,
    includeOnly: ["transitive capture/caller/fixed-parent imports", "all capture/caller eligibility reads", "fresh actual composite approval", "required proofs/reviews/execution bindings", "unchanged pinned reference lock", "two unchanged existing observer helpers"],
    exclude: ["archives", "caches", "native binaries", "unrelated repository files", "old failed LLVM pipeline", "failed full1", "actual operation roots", "observer subtree", "raw archive roots", "selected output roots"],
    verifyBeforeExclusiveMaterialization: ["response/decoded/source/file/directory bounds", "literal finite relative path membership", "byte length", "SHA256", "committed Git blob identity"],
    verifyEntireTableBeforeFirstSourceFileWrite: true, noOverwriteAdoptionSubstitutionFallbackRetriesOrDeletion: true, snapshotSourceFilesImmutable: true,
    snapshotDirectoryDerivation: "SNAPSHOT_ROOT_AND_UNIQUE_PARENTS_OF_LITERAL_TABLE_PLUS_ONE_EXPLICIT_OBSERVER_SUBTREE", snapshotDirectoryCapIncludesRootAndObserver: true,
    unknownSourceFilesOrPlaceholderHashesAllowed: false, packetMayContainItsOwnPublicationHash: false
  });
  same(p["observerCompatibility"], {
    implementation: "REUSE_EXISTING_UNMODIFIED_runBounded", helpers: HELPER_PINS, retainRelativeHelperPathsInsideSnapshot: true,
    helperInternalRoot: "SNAPSHOT", prefixGuardWorkBase: "SNAPSHOT/_work/gpu-owner-recovery", relativeObserverRootFromOriginalPlan: plan["observerRoot"], relativeObserverRootBase: "SNAPSHOT",
    snapshotPhysicalDescendantOfHostRoot: true, snapshotFullyReadOnly: false, onlyWritableSnapshotSubtree: "OUTER_OBSERVER",
    onlyWritableObserverFiles: ["command.stdout", "command.stderr", "observation.json"], sourcePacketMembershipExcludesObserverSubtree: true, otherOutputsMayImplicitlyRedirectToSnapshot: false
  });
  same(p["directoryPhases"], {
    modeForNewDirectories: "0700", recursive: false, existingDirectoryPolicy: "LSTAT_NONSYMLINK_DIRECTORY_ONLY_NO_ENUMERATION_CHMOD_DELETION_OR_PAYLOAD_READS", requiredExistingRunsAndAncestors: true,
    handoffClaim: { rootKey: "H", phase: "STAGE_A_AFTER_READ_ONLY_PRECONDITIONS_BEFORE_OTHER_CREATIONS", mustBeFresh: true }, afterHandoffClaimFreshRoots: ["SNAPSHOT", "EVIDENCE"],
    hostOperationParents: HOST_OPERATION_PARENTS.map(path => ({ path, phase: "STAGE_A_AFTER_HANDOFF_CLAIM_AND_PACKET_SEAL_BEFORE_INNER_CALLER", createOnlyIfAbsent: true })),
    snapshotDescendantsFromLiteralTableOnlyExceptExplicitObserver: true,
    observer: { rootKey: "OUTER_OBSERVER", phase: "STAGE_B_OUTER_ELIGIBILITY_PASSED_BEFORE_CAPTURE_RUNS", mustBeFresh: true },
    innerClaim: { rootKey: "CAPTURE_OP2", phase: "STAGE_B_CAPTURE_ELIGIBILITY_PASSED_EXCLUSIVE_INNER_COMBINED_CLAIM", mustBeFresh: true },
    cacheParent: { rootKey: "CACHE_COMMON_PARENT", phase: "STAGE_B_AFTER_REAL_NEW_INNER_CLAIM", onlyIfAbsent: true, module: "prepareFixedCacheParent" },
    afterFixedParentFreshRoots: ["RAW2", "OUTPUT2", "OUTPUT_FILES2"], stageAMustNotCreate: ["CACHE_COMMON_PARENT", "RAW2", "OUTPUT2", "OUTPUT_FILES2", "CAPTURE_OP2"],
    noAncestorRepairOutsideEnumeratedParents: true, preserveOldR1Source1AndOldCacheContentsWithoutEnumeration: true, postClaimFailuresPreservePartialsWithoutRollback: true
  });
  same(p["currentPreparation"], { manualAddendaAndStaticSyntheticContractTestsOnly: true, fullTransferImplementationPresent: false, fullCaptureCallerOrDeliveryPresent: false, actualCompositeApprovalExists: false, literalSourceTableFrozen: false, bindingsOrReadinessCreated: false, actualGitHubRequests: 0, actualNpmRequests: 0, actualHostCommands: 0, productionDirectoriesCreated: false, commitOrPushPerformed: false, assistantManualExecutionAuthorized: false, currentLiveAcquisitionGrant: 0, currentAuthorizedManualHandoffAttempts: 0, newGrantIssued: false, executionReadinessClaimed: false, trainingReady: false });
  same(p["requiredImplementationReviewScopes"], { capture: ["backend", "DevOps", "adversarial", "security"], caller: ["backend", "DevOps", "adversarial", "security"], delivery: ["backend", "DevOps", "adversarial", "security"], allBeforeExecutionBindings: true, proposalReviewsAreNotImplementationReviews: true });
}
interface SyntheticTextRow { path: string; text: string; bytes: number; sha256: string; gitBlobId: string }
function syntheticRow(path: string, text = "synthetic text\n"): SyntheticTextRow {
  const data = Buffer.from(text);
  return { path, text, bytes: data.length, sha256: hash(data), gitBlobId: createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex") };
}
function checkSyntheticTable(rows: SyntheticTextRow[], allowedPaths: readonly string[], decodedBytes: number, responseBytes: number): void {
  assert.ok(rows.length > 0 && rows.length <= ENVELOPE_CAPS.maximumFiles);
  assert.ok(Number.isSafeInteger(decodedBytes) && decodedBytes > 0 && decodedBytes <= ENVELOPE_CAPS.maximumDecodedPacketBytes);
  assert.ok(Number.isSafeInteger(responseBytes) && responseBytes > 0 && responseBytes <= ENVELOPE_CAPS.maximumGitHubApiResponseBytes);
  const seen = new Set<string>(), directories = new Set<string>([".", String(plan["observerRoot"])]);
  for (let parent = posix.dirname(String(plan["observerRoot"])); parent !== "."; parent = posix.dirname(parent)) directories.add(parent);
  let aggregate = 0;
  for (const row of rows) {
    assert.ok(allowedPaths.includes(row.path)); assert.ok(!seen.has(row.path)); seen.add(row.path);
    assert.ok(row.path !== "." && !row.path.startsWith("/") && posix.normalize(row.path) === row.path && !row.path.includes("\\") && !row.path.includes("\0"));
    assert.ok(!row.path.split("/").some(part => ["..", "cache", ".git", "full1", "old-failed-llvm-pipeline"].includes(part) || /^(?:acquisition-execution-|acquisition-invocation-|package-inputs-|reference-package-inputs-)/.test(part)));
    assert.ok(!/\.(?:tgz|tar|gz|xz|zip|bpk|so|o|exe)$/.test(row.path));
    assert.ok(!row.text.includes("\0"));
    const data = Buffer.from(row.text);
    assert.ok(Number.isSafeInteger(row.bytes) && row.bytes >= 0 && row.bytes <= ENVELOPE_CAPS.maximumBytesPerFile);
    same(row.bytes, data.length); same(row.sha256, hash(data));
    same(row.gitBlobId, createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex"));
    aggregate += data.length;
    for (let parent = posix.dirname(row.path); parent !== "."; parent = posix.dirname(parent)) directories.add(parent);
  }
  assert.ok(aggregate <= ENVELOPE_CAPS.maximumAggregateSourceBytes && aggregate <= decodedBytes);
  assert.ok(directories.size <= ENVELOPE_CAPS.maximumSnapshotDirectories);
}
describe("unapproved manual-handoff addenda static/synthetic contracts only", () => {
  test("fresh serialization/reparse binds both manual records to the exact unchanged R2 byte hashes", () => {
    same(copy(manualRequest), manualRequest); same(copy(manualPlan), manualPlan);
    validateManualContract(copy(manualRequest), copy(manualPlan));
  });
  test("GitHub transfer and npm acquisition have separate counters and sequential budgets", () => {
    validateManualContract(manualRequest, manualPlan);
    same(record(manualRequest["requestedOperations"])["githubSourcePacketFetchRequests"], 1);
    same(record(manualRequest["requestedOperations"])["innerNpmGets"], 2);
    same(record(manualPlan["stageBudgets"])["globalManualDeadlineMs"], null);
    same(record(manualPlan["stageBudgets"])["nominalSumIsUnconditionalWholeScriptBound"], false);
    same(request["requestedLimits"], plan["limits"]);
  });
  test("rejects either addendum mutating either immutable R2 byte-hash binding", () => {
    for (const name of ["request", "plan"]) {
      const r = copy(manualRequest); record(record(r["immutableAcquisitionInputs"])[name])["sha256"] = "0".repeat(64);
      assert.throws(() => validateManualContract(r, manualPlan));
      const p = copy(manualPlan); record(record(p["immutableAcquisitionInputs"])[name])["sha256"] = "0".repeat(64);
      assert.throws(() => validateManualContract(manualRequest, p));
    }
  });
  test("capture, caller, and delivery each require four implementation review roles before bindings", () => {
    const p = copy(manualPlan); record(p["requiredImplementationReviewScopes"])["delivery"] = ["backend"];
    assert.throws(() => validateManualContract(manualRequest, p));
  });
  test("unchanged helper relative root and runBounded prefix guard accept only the snapshot observer context", () => {
    for (const helper of HELPER_PINS) {
      const bytes = readFileSync(join(ROOT, helper.path)); same(bytes.length, helper.bytes); same(hash(bytes), helper.sha256);
    }
    const helperRoot = resolve(fileURLToPath(new URL("../../", pathToFileURL(join(SNAPSHOT, HELPER_PINS[0]!.path)))));
    same(helperRoot, SNAPSHOT);
    const work = resolve(helperRoot, "_work/gpu-owner-recovery");
    assert.ok(MANUAL_ROOTS.OUTER_OBSERVER.startsWith(work + "/"));
    assert.ok(!MANUAL_ROOTS.CAPTURE_OP2.startsWith(work + "/"));
    const source = readFileSync(join(ROOT, HELPER_PINS[0]!.path), "utf8");
    assert.ok(source.includes('fileURLToPath(new URL("../../", import.meta.url))'));
    assert.ok(source.includes('!directory.startsWith(work + "/")'));
    assert.ok(source.includes('Bun.spawn([process.execPath, "--no-env-file", "--no-install", resolve(work, "command-supervisor.ts")]'));
    validateManualContract(manualRequest, manualPlan);
  });
  test("SNAPSHOT is inside HOSTROOT but OP/raw/output remain outside SNAPSHOT", () => {
    assert.ok(!relative(ROOT, SNAPSHOT).startsWith(".."));
    for (const path of [MANUAL_ROOTS.CAPTURE_OP2, MANUAL_ROOTS.CACHE_COMMON_PARENT, MANUAL_ROOTS.RAW2, MANUAL_ROOTS.OUTPUT2, MANUAL_ROOTS.OUTPUT_FILES2]) {
      assert.ok(path.startsWith(ROOT + "/")); assert.ok(!path.startsWith(SNAPSHOT + "/"));
    }
    same(MANUAL_ROOTS.OUTER_OBSERVER, join(SNAPSHOT, String(plan["observerRoot"])));
    same(MANUAL_ROOTS.CAPTURE_OP2, join(ROOT, String(plan["operationRoot"])));
    validateManualContract(manualRequest, manualPlan);
  });
  test("only three finite HOST operation parents may be created after handoff claim and seal", () => {
    for (let i = 1; i < HOST_OPERATION_PARENTS.length; i++) same(posix.dirname(HOST_OPERATION_PARENTS[i]!), HOST_OPERATION_PARENTS[i - 1]);
    same(HOST_OPERATION_PARENTS.length, 3);
    same(record(manualPlan["directoryPhases"])["stageAMustNotCreate"], ["CACHE_COMMON_PARENT", "RAW2", "OUTPUT2", "OUTPUT_FILES2", "CAPTURE_OP2"]);
    validateManualContract(manualRequest, manualPlan);
  });
  test("publication selection alone grants no handoff, fetch, registry, or cache authority", () => {
    const selection = json(`${D}/ready-retry-publication-selection1.json`);
    same(selection["maximumNormalCommits"], 1); same(selection["maximumHttpsPushes"], 1);
    same(selection["freshActualRetryApprovalStillRequired"], true); same(selection["newAcquisitionGrantIssuedByThisSelection"], false);
    same(selection["actualProductionCacheParentCreationApprovedByThisSelection"], false); same(selection["manualCommandExecutionByAssistantApproved"], false);
    validateManualContract(manualRequest, manualPlan);
  });
  for (const field of ["maximumFiles", "maximumBytesPerFile", "maximumAggregateSourceBytes", "maximumDecodedPacketBytes", "maximumGitHubApiResponseBytes", "maximumSnapshotDirectories", "githubFetchRequests", "githubFetchMs"]) {
    for (const value of [0, -1, Number(ENVELOPE_CAPS[field as keyof typeof ENVELOPE_CAPS]) + 1]) {
      test(`rejects source-envelope bound ${field}=${value}`, () => {
        const r = copy(manualRequest); record(r["requestedSourceEnvelope"])[field] = value;
        assert.throws(() => validateManualContract(r, manualPlan));
        const p = copy(manualPlan); record(p["sourceTransferEnvelope"])[field] = value;
        assert.throws(() => validateManualContract(manualRequest, p));
      });
    }
  }
  for (const field of ["sourceTransferAndMaterializationMs", "sourceGitHubFetchMs", "acquisitionOperationMs"]) {
    test(`rejects zero, reset, or widened stage budget ${field}`, () => {
      for (const value of [0, 1, 240000]) {
        const r = copy(manualRequest); record(r["requestedTiming"])[field] = value;
        assert.throws(() => validateManualContract(r, manualPlan));
        const p = copy(manualPlan); record(p["stageBudgets"])[field] = value;
        assert.throws(() => validateManualContract(manualRequest, p));
      }
    });
  }
  for (const field of ["globalManualDeadlineMs", "acquisitionDeadlineResetAllowed", "newWholeScriptCancellationAllowed", "acquisitionWorkerExistsDuringStageA", "stageASealedAndGithubChildrenFinishedBeforeStageB", "existingOwnedChildCleanupMustComplete"]) {
    test(`rejects deadline/cleanup context weakening ${field}`, () => {
      const p = copy(manualPlan), budgets = record(p["stageBudgets"]); budgets[field] = field === "globalManualDeadlineMs" ? 240000 : !budgets[field];
      assert.throws(() => validateManualContract(manualRequest, p));
    });
  }
  for (const field of ["READ_ROOT", "OP_ROOT", "OUTER_OBSERVER", "CAPTURE_OP2", "RAW2", "OUTPUT2"]) {
    test(`rejects root-base mixing in ${field}`, () => {
      const p = copy(manualPlan); record(p["rootMatrix"])[field] = field === "READ_ROOT" || field === "OUTER_OBSERVER" ? ROOT : SNAPSHOT;
      assert.throws(() => validateManualContract(manualRequest, p));
    });
  }
  for (const field of ["manualHandoffApproved", "githubSourceFetchApproved", "registryAcquisitionApproved", "productionCacheOrDestinationCreationApproved", "actualCompositeApprovalExists", "newGrantIssued", "executionReadinessClaimed"]) {
    test(`rejects authority=true in ${field}`, () => {
      const r = copy(manualRequest); r[field] = true;
      assert.throws(() => validateManualContract(r, manualPlan));
    });
  }
  for (const field of ["autoInstall", "taskRunAutoInstall", "arbitraryExecutableOverride", "assumeHostUsrLocalBinBun"]) {
    test(`rejects Bun tool widening ${field}`, () => {
      const p = copy(manualPlan); record(record(p["toolContract"])["bun"])[field] = true;
      assert.throws(() => validateManualContract(manualRequest, p));
    });
  }
  test("rejects arbitrary executable, repository substitution, Git integration, or snapshot-readonly fiction", () => {
    const cases: [string, string, unknown][] = [["toolContract", "gitPullCheckoutMergeCherryPickHooksOrOriginalFeatureBranchIntegration", true], ["observerCompatibility", "snapshotFullyReadOnly", true], ["observerCompatibility", "otherOutputsMayImplicitlyRedirectToSnapshot", true]];
    for (const [section, field, value] of cases) {
      const p = copy(manualPlan); record(p[section])[field] = value;
      assert.throws(() => validateManualContract(manualRequest, p));
    }
    const p = copy(manualPlan); record(record(p["toolContract"])["bun"])["childExecutable"] = "/arbitrary/bun";
    assert.throws(() => validateManualContract(manualRequest, p));
    const r = copy(manualRequest); record(r["requestedGitHubSource"])["repository"] = "other/repository";
    assert.throws(() => validateManualContract(r, manualPlan));
  });
  test("rejects old grant reuse and restored or deliberately consumed unclaimed inner allowance", () => {
    for (const [key, value] of [["innerGrantId", "reference-two-package-source-acquisition-1"], ["oldSpentGrantOrUnusedUrlSlotsReusable", true], ["failedHandoffRestoresInnerAllowance", true], ["failedHandoffDeliberatelyConsumesUnclaimedInnerAllowance", true]] as const) {
      const p = copy(manualPlan); record(p["attemptAccounting"])[key] = value;
      assert.throws(() => validateManualContract(manualRequest, p));
    }
  });
  test("rejects parent-prefix expansion, recursive repair, or cache creation during handoff", () => {
    const p = copy(manualPlan), phases = record(p["directoryPhases"]);
    (phases["hostOperationParents"] as unknown[]).push({ path: `${ROOT}/unexpected-parent`, createOnlyIfAbsent: true });
    assert.throws(() => validateManualContract(manualRequest, p));
    const p2 = copy(manualPlan); record(record(p2["directoryPhases"])["cacheParent"])["phase"] = "STAGE_A_AFTER_HANDOFF_CLAIM";
    assert.throws(() => validateManualContract(manualRequest, p2));
    const r = copy(manualRequest); record(r["requestedDirectoryPolicy"])["recursiveAncestorRepairAuthorized"] = true;
    assert.throws(() => validateManualContract(r, manualPlan));
  });
  test("rejects composite approval missing either manual hash binding or using publication selection as approval", () => {
    const r = copy(manualRequest); (record(r["requiredCompositeApproval"])["requiredRecordHashBindingPaths"] as unknown[]).pop();
    assert.throws(() => validateManualContract(r, manualPlan));
    const r2 = copy(manualRequest); record(r2["requiredCompositeApproval"])["publicationSelectionIsApproval"] = true;
    assert.throws(() => validateManualContract(r2, manualPlan));
  });
  test("no actual approval, literal source closure, full transfer code, or executable eligibility exists", () => {
    assert.equal(existsSync(join(ROOT, R2, "approval2.json")), false);
    assert.equal(existsSync(join(ROOT, S2, "capture.ts")), false);
    assert.equal(existsSync(join(ROOT, R2, "invoke-approved-bun.ts")), false);
    same(record(manualPlan["sourceTransferEnvelope"])["literalFileTablePresent"], false);
    same(record(manualPlan["currentPreparation"])["fullTransferImplementationPresent"], false);
    same(manualRequest["currentLiveAcquisitionGrant"], 0);
    validateManualContract(manualRequest, manualPlan);
  });
  test("synthetic-only literal text table verifies real length, SHA256, and Git blob identity", () => {
    const row = syntheticRow(`${S2}/cache-parent.ts`);
    checkSyntheticTable([row], [row.path], row.bytes + 1024, row.bytes + 2048);
    for (const field of ["bytes", "sha256", "gitBlobId"]) {
      const changed = { ...row, [field]: field === "bytes" ? row.bytes + 1 : "0".repeat(field === "sha256" ? 64 : 40) };
      assert.throws(() => checkSyntheticTable([changed], [row.path], 4096, 8192));
    }
  });
  test("synthetic table rejects unlisted paths, duplicates, empty membership, and 97 files", () => {
    const row = syntheticRow(`${S2}/cache-parent.ts`);
    assert.throws(() => checkSyntheticTable([row], [], 4096, 8192));
    assert.throws(() => checkSyntheticTable([row, row], [row.path], 4096, 8192));
    assert.throws(() => checkSyntheticTable([], [], 4096, 8192));
    const rows = Array.from({ length: 97 }, (_, i) => syntheticRow(`synthetic-only/case-${i}.ts`, "x"));
    checkSyntheticTable(rows.slice(0, 96), rows.map(value => value.path), 4096, 8192);
    assert.throws(() => checkSyntheticTable(rows, rows.map(value => value.path), 4096, 8192));
  });
  for (const path of [`${R2}/acquisition-invocation-1/command.stdout`, `${R2}/acquisition-execution-1/attempt.json`, "_work/gpu-owner-recovery/cache/archive.json", `${D}/package-inputs-2/files/source.ts`, "full1/receipt.json", "old-failed-llvm-pipeline/source.ts", "binary.so", "archive.tgz", "../escape.ts", "/absolute.ts", "a/../b.ts"]) {
    test(`synthetic table excludes observer/operation/cache/binary/unsafe path ${path}`, () => {
      const row = syntheticRow(path); assert.throws(() => checkSyntheticTable([row], [path], 4096, 8192));
    });
  }
  test("synthetic table enforces file, aggregate, decoded, response, and directory caps at boundaries", () => {
    const row = syntheticRow("synthetic-only/boundary.ts", "x".repeat(1048576));
    checkSyntheticTable([row], [row.path], 8388608, 12582912);
    const tooLarge = syntheticRow(row.path, row.text + "x"); assert.throws(() => checkSyntheticTable([tooLarge], [row.path], 8388608, 12582912));
    const rows = Array.from({ length: 7 }, (_, i) => ({ ...row, path: `synthetic-only/boundary-${i}.ts` }));
    checkSyntheticTable(rows.slice(0, 6), rows.map(value => value.path), 8388608, 12582912);
    assert.throws(() => checkSyntheticTable(rows, rows.map(value => value.path), 8388608, 12582912));
    for (const [decoded, response] of [[0, 8192], [4096, 0], [8388609, 12582912], [8388608, 12582913]]) assert.throws(() => checkSyntheticTable([syntheticRow(row.path)], [row.path], decoded!, response!));
    const maximumSyntheticParents = 256 - String(plan["observerRoot"]).split("/").length - 1;
    const boundary = syntheticRow(Array.from({ length: maximumSyntheticParents }, (_, i) => `synthetic-${i}`).join("/") + "/file.ts");
    checkSyntheticTable([boundary], [boundary.path], 4096, 8192);
    const deep = syntheticRow(posix.dirname(boundary.path) + "/one-more/file.ts");
    assert.throws(() => checkSyntheticTable([deep], [deep.path], 4096, 8192));
  });
});
