// SPEC: _spec/recovery.md
import { expect, test } from "bun:test";
import { constants } from "node:fs";
import { dirname, resolve } from "node:path";
import { environment, repository } from "./provision";
import { sha256 } from "./cuda-continuation";
import { bindingVersion, captureBunSnapshot, completedSnapshotPins, completedSnapshotProofPaths, historicalProofPaths, historicalSnapshotPaths, historicalSourcePaths, postSnapshotRequest, productionIO,
  proofPaths, readSnapshotInputs, reviewedFiles, runSnapshotMiseStages, snapshotEnvironment, snapshotFailureCode, snapshotIdentity,
  snapshotLimits, snapshotPaths, snapshotPins, snapshotRenewalRequest, snapshotStagePlan, snapshotTestOnly,
  validateSnapshotMiseDiscovery, validateSnapshotReceipt, validateSnapshotRenewal, validateSnapshotTaskConfiguration } from "./cuda-bun-snapshot";
import type { CompletedSnapshotProofs, SnapshotHandle, SnapshotInputs, SnapshotStat, TrustedSnapshotIO, TrustedSnapshotMiseIO } from "./cuda-bun-snapshot";

const bytes = (value: string) => new TextEncoder().encode(value), json = (value: unknown) => bytes(JSON.stringify(value));
const parse = (value: Uint8Array) => JSON.parse(new TextDecoder().decode(value)) as Record<string, unknown>;
const abs = (path: string) => resolve(repository, path);
const rawProofs: Record<string, Uint8Array> = Object.fromEntries(await Promise.all(proofPaths.map(async path => [path, await snapshotTestOnly.readSmall(abs(path), productionIO)])));
const rawFiles: Record<string, Uint8Array> = Object.fromEntries(await Promise.all(reviewedFiles.map(async path => [path, await snapshotTestOnly.readSmall(abs(path), productionIO)])));
const completedRun = "_work/gpu-owner-recovery/runs/cuda-bun-snapshot-1/";
const completedSourcePaths = reviewedFiles.map((_, i) => `${completedRun}source-snapshot/${String(i).padStart(2, "0")}.source`);
const rawCompletedProofs: Record<string, Uint8Array> = Object.fromEntries(await Promise.all(completedSnapshotProofPaths.map(async path =>
  [path, rawProofs[path] ?? await snapshotTestOnly.readSmall(abs(path), productionIO)])));
const config = rawFiles[snapshotPaths.taskConfiguration]!;
const halted = parse(rawProofs[snapshotPaths.haltedRequest]!);
function expectedRenewal(): Record<string, unknown> {
  return { ...structuredClone(halted), status: "APPROVED_SEQUENCE_IN_PROGRESS_AFTER_PRIVATE_BUN_SNAPSHOT_RENEWAL", authorityGranted: true,
    authorization: { ...halted.authorization as object, grantStatus: "APPROVED_SEQUENCE_IN_PROGRESS" }, phase: "PRIVATE_BUN_SNAPSHOT_SOURCE_GATES_PENDING",
    renewedExecutorDecisionRequired: false,
    nativeBunSnapshotRenewal: { selectedOption: "Private Bun snapshot (Recommended)",
      previousHaltedRequestCapture: "_work/gpu-owner-recovery/runs/cuda-bun-snapshot-1/request-before-renewal.json",
      previousHaltedRequestSha256: "51d56812426992f2ad9e85980a35630fe620220a5fb562d7af20b009e1c3eb82",
      remainingApprovedPipelineRenewed: true, completedDownloadsMayRepeat: false, oneOutsideSnapshotDeadlineMs: 30000, firstActualFailureStopsSequence: true },
    nativeBunSnapshot: { grantStatus: "APPROVED_NOT_EXECUTED", source: "/usr/local/bin/bun", byteLength: 80761952,
      sha256: "33d56b070be6a9e3da0ab013038b43d1645d0534ca811ecdba4472599117eb4b", destination: "_work/gpu-owner-recovery/cache/native-audit-bun-1/bun",
      directoryMode: "0700", executableMode: "0500", sourceReadException: { path: "/usr/local/bin", uid: 1001, gid: 1001, mode: "0755",
        scope: "PINNED_BYTE_CAPTURE_READ_ONLY_NEVER_EXECUTABLE_BINDING" },
      outerBootstrapTrust: "EXISTING_C1_BUN_AND_MISE_BOOTSTRAP_ASSUMPTION_RETAINED_NOT_AUTHENTICATED_BY_GUEST_SNAPSHOT",
      taskConfiguration: "_work/gpu-owner-recovery/cuda-bun-snapshot-mise.toml" } };
}
export function snapshotFixture(): SnapshotInputs {
  const requestBytes = json(expectedRenewal()), files = Object.fromEntries(Object.entries(rawFiles).map(([path, data]) => [path, data.slice()]));
  const predecessorProofs = Object.fromEntries(Object.entries(rawProofs).map(([path, data]) => [path, data.slice()]));
  return { requestBytes, binding: { version: bindingVersion, staticUnitTestsPassed: true, staticTypesPassed: true, adversarialSourceAccepted: true,
    securitySourceAccepted: true, devopsSourceAccepted: true, requestSha256: sha256(requestBytes),
    files: Object.fromEntries(Object.entries(files).map(([path, data]) => [path, sha256(data)])),
    predecessorProofs: Object.fromEntries(Object.entries(predecessorProofs).map(([path, data]) => [path, sha256(data)])) }, evidence: { files, predecessorProofs } };
}
const reviewOf = (input: SnapshotInputs) => input.binding as Record<string, unknown>;
function requestMutation(input: SnapshotInputs, edit: (request: Record<string, unknown>) => void): SnapshotInputs {
  const request = parse(input.requestBytes); edit(request); const requestBytes = json(request);
  return { ...input, requestBytes, binding: { ...reviewOf(input), requestSha256: sha256(requestBytes) } };
}
async function rejection(work: Promise<unknown>): Promise<unknown> {
  try { await work; } catch (error) { return error; }
  throw Error("EXPECTED_REJECTION");
}
type Node = { identity: SnapshotStat; data: Uint8Array };
type Call = { op: string; path: string; flags?: number; mode?: number; position?: number; length?: number };
const stat = (inode: string, mode: number, uid = 1000, size = 0): SnapshotStat => ({ device: "1", inode, bytes: size, mode,
  uid, gid: uid, links: 1, mtime: "1", ctime: "1" });
function fakeIO(input = snapshotFixture()) {
  const nodes = new Map<string, Node>(), realPaths = new Map<string, string>(), events: string[] = [], calls: Call[] = [];
  let serial = 0, clock = 1, writeLimit = 65536, readLimit = 65536, hook: (event: string) => void = () => {};
  const label = (path: string): string => ({ [snapshotPaths.source]: "source", [abs(snapshotPaths.pending)]: "pending", [abs(snapshotPaths.destination)]: "final",
    [abs(snapshotPaths.operation)]: "operation", [abs(snapshotPaths.captureStage)]: "receipt-stage", [abs(snapshotPaths.capture)]: "receipt",
    [abs(snapshotPaths.attemptDirectory)]: "attempt" })[path] ?? path;
  const event = (name: string, call: Call) => { events.push(name); calls.push(call); hook(name); };
  const error = (code: string) => Object.assign(Error(code), { code });
  const get = (path: string): Node => { const node = nodes.get(path); if (!node) throw error("ENOENT"); return node; };
  const touch = (node: Node) => { node.identity = { ...node.identity, mtime: String(++clock), ctime: String(clock) }; };
  const addDirectory = (path: string, mode = 0o40755, uid = 1000) => {
    if (path !== "/" && !nodes.has(dirname(path))) addDirectory(dirname(path));
    nodes.set(path, { identity: stat(String(++serial), mode, uid), data: new Uint8Array() });
  };
  const addFile = (path: string, data: Uint8Array, mode = 0o100600, uid = 1000) => {
    if (!nodes.has(dirname(path))) addDirectory(dirname(path));
    nodes.set(path, { identity: stat(String(++serial), mode, uid, data.byteLength), data: data.slice() });
  };
  addDirectory("/", 0o40755, 0); addDirectory("/usr", 0o40755, 0); addDirectory("/usr/local", 0o40755, 0); addDirectory("/usr/local/bin", 0o40755, 1001);
  addDirectory(abs(snapshotPaths.runDirectory), 0o40700); addDirectory(abs(snapshotPaths.cache), 0o40700);
  addFile(snapshotPaths.source, bytes("abc"), 0o100755, 0);
  const io: TrustedSnapshotIO = {
    uid: () => 1000,
    async readInputs() { event("inputs", { op: "inputs", path: "" }); return input; },
    async lstat(path) { event(`lstat:${label(path)}`, { op: "lstat", path }); return { ...get(path).identity }; },
    async realpath(path) { event(`realpath:${label(path)}`, { op: "realpath", path }); get(path); return realPaths.get(path) ?? path; },
    async mkdir(path, mode) {
      event(`mkdir:${label(path)}`, { op: "mkdir", path, mode }); if (nodes.has(path)) throw error("EEXIST");
      get(dirname(path)); addDirectory(path, 0o40000 | mode); touch(get(dirname(path)));
    },
    async link(from, to) {
      event(`link:${label(to)}`, { op: "link", path: to }); if (nodes.has(to)) throw error("EEXIST"); get(dirname(to));
      const node = get(from); node.identity = { ...node.identity, links: node.identity.links + 1, ctime: String(++clock) };
      nodes.set(to, node); touch(get(dirname(to)));
    },
    async open(path, flags, mode) {
      event(`open:${label(path)}`, { op: "open", path, flags, ...(mode !== undefined ? { mode } : {}) });
      if ((flags & constants.O_CREAT) !== 0) {
        if ((flags & constants.O_EXCL) !== 0 && nodes.has(path)) throw error("EEXIST");
        get(dirname(path)); addFile(path, new Uint8Array(), 0o100000 | mode!); touch(get(dirname(path)));
      }
      const node = get(path);
      if ((flags & constants.O_NOFOLLOW) !== 0 && (node.identity.mode & 0o170000) === 0o120000) throw error("ELOOP");
      let isClosed = false;
      const handle: SnapshotHandle = {
        async stat() { event(`stat:${label(path)}`, { op: "stat", path }); if (isClosed) throw error("EBADF"); return { ...node.identity }; },
        async read(buffer, offset, length, position) {
          event(`read:${label(path)}:${position}`, { op: "read", path, position, length }); if (isClosed) throw error("EBADF");
          const count = Math.min(length, readLimit, Math.max(0, node.data.byteLength - position));
          buffer.set(node.data.subarray(position, position + count), offset); return count;
        },
        async write(buffer, offset, length, position) {
          event(`write:${label(path)}:${position}`, { op: "write", path, position, length }); if (isClosed) throw error("EBADF");
          const count = Math.min(length, writeLimit), data = new Uint8Array(Math.max(node.data.byteLength, position + count));
          data.set(node.data); data.set(buffer.subarray(offset, offset + count), position); node.data = data;
          node.identity = { ...node.identity, bytes: data.byteLength }; touch(node); return count;
        },
        async sync() { event(`sync:${label(path)}`, { op: "sync", path }); if (isClosed) throw error("EBADF"); },
        async chmod(mode) { event(`chmod:${label(path)}:${mode.toString(8)}`, { op: "chmod", path, mode });
          if (isClosed) throw error("EBADF"); node.identity = { ...node.identity, mode: 0o100000 | mode, ctime: String(++clock) }; },
        async close() { try { event(`close:${label(path)}`, { op: "close", path }); if (isClosed) throw error("EBADF"); } finally { isClosed = true; } },
      };
      return handle;
    },
  };
  return { io, nodes, realPaths, events, calls, get, addDirectory, addFile,
    setInput(value: SnapshotInputs) { input = value; }, setHook(value: (event: string) => void) { hook = value; },
    setWriteLimit(value: number) { writeLimit = value; }, setReadLimit(value: number) { readLimit = value; },
    failAt(name: string, failure: unknown, occurrence = 1) { let seen = 0; hook = event => { if (event === name && ++seen === occurrence) throw failure; }; },
  };
}
type Fake = ReturnType<typeof fakeIO>;
const runFake = (fake: Fake) => snapshotTestOnly.capture(fake.io);
const noPass = (fake: Fake) => expect(fake.nodes.has(abs(snapshotPaths.capture))).toBe(false);
const changeStat = (fake: Fake, path: string, changes: Partial<SnapshotStat>) => { const node = fake.get(path); node.identity = { ...node.identity, ...changes }; };

test("snapshot wire identities, immutable halted transition and source/proof membership stay closed", () => {
  expect(snapshotIdentity).toEqual({ source: "/usr/local/bin/bun", byteLength: 80761952,
    sha256: "33d56b070be6a9e3da0ab013038b43d1645d0534ca811ecdba4472599117eb4b", destination: "_work/gpu-owner-recovery/cache/native-audit-bun-1/bun" });
  expect(bindingVersion).toBe("chess-coach.cuda-bun-snapshot-source-review.v1"); expect(Object.isFrozen(snapshotIdentity)).toBe(true);
  expect(snapshotPaths.binding).toBe("_work/gpu-owner-recovery/cuda-bun-snapshot-reviewed.json");
  expect(snapshotRenewalRequest(halted)).toEqual(expectedRenewal());
  expect(sha256(rawProofs[snapshotPaths.haltedRequest]!)).toBe(snapshotPins.haltedRequest);
  expect(historicalProofPaths).toHaveLength(36); expect(historicalSourcePaths).toHaveLength(23); expect(historicalSnapshotPaths).toHaveLength(23);
  expect(reviewedFiles).toHaveLength(18); expect(proofPaths).toHaveLength(69); expect(new Set(proofPaths).size).toBe(proofPaths.length);
  expect(reviewedFiles).toContain("tsconfig.json"); expect(reviewedFiles).toContain(`${"_work/gpu-owner-recovery/"}command-supervisor.ts`);
  expect(historicalSnapshotPaths.every(path => path.endsWith(".source"))).toBe(true);
  expect(() => validateSnapshotRenewal(snapshotFixture())).not.toThrow();
});

test("renewal helper rejects any baseline scope, denial, unknown-field or non-JSON mutation", () => {
  for (const edit of [
    (r: Record<string, unknown>) => { r.authorityGranted = true; }, (r: Record<string, unknown>) => { r.trainingAuthorized = true; },
    (r: Record<string, unknown>) => { r.extraGrant = true; }, (r: Record<string, unknown>) => { r.unknown = undefined; },
    (r: Record<string, unknown>) => { (r.authorization as Record<string, unknown>).scope = "PROBE_ONLY"; },
  ]) { const baseline = structuredClone(halted); edit(baseline); expect(() => snapshotRenewalRequest(baseline)).toThrow(); }
});

test("only the exact capture selector reaches any input or filesystem operation", async () => {
  const fake = fakeIO();
  for (const args of [[], ["audit"], ["--help"], ["capture", "capture"], ["capture", "--path", "/x"], ["https://evil.test"], ["../bun"], ["CAPTURE"]]) {
    await expect(captureBunSnapshot(args, fake.io)).rejects.toThrow("CLOSED_BUN_SNAPSHOT_CLI_REQUIRED");
  }
  expect(fake.events).toEqual([]); expect(() => snapshotTestOnly.capture(productionIO)).toThrow("FAKE_SNAPSHOT_IO_REQUIRED");
});

test("halted, probe-only, missing, consumed, advanced or broadened requests reject before claim", async () => {
  const edits: ((r: Record<string, unknown>) => void)[] = [
    r => { r.authorityGranted = false; }, r => { r.status = "HALTED_AFTER_FIRST_FAILURE"; }, r => { r.renewedExecutorDecisionRequired = true; },
    r => { r.phase = "PRIVATE_BUN_SNAPSHOT_CAPTURED"; }, r => { r.phase = "HALTED_BEFORE_PASSIVE_ARCHIVE_AUDIT"; }, r => { delete r.authorization; },
    r => { (r.authorization as Record<string, unknown>).grantStatus = "CONSUMED_SUCCESS"; },
    r => { (r.authorization as Record<string, unknown>).scope = "INERT_PROBE_ONLY"; },
    r => { (r.authorization as Record<string, unknown>).firstActualFailureStopsSequence = false; },
    r => { (r.nativeBunSnapshot as Record<string, unknown>).grantStatus = "CONSUMED_SUCCESS"; },
    r => { (r.nativeBunSnapshot as Record<string, unknown>).source = "/bin/bun"; },
    r => { (r.nativeBunSnapshot as Record<string, unknown>).destination = "elsewhere"; },
    r => { (r.nativeBunSnapshot as Record<string, unknown>).outerBootstrapTrust = "SNAPSHOT_AUTHENTICATES_OUTER_BOOTSTRAP"; },
    r => { (r.nativeBunSnapshotRenewal as Record<string, unknown>).completedDownloadsMayRepeat = true; },
    r => { (r.nativeBunSnapshotRenewal as Record<string, unknown>).oneOutsideSnapshotDeadlineMs = 60000; },
    r => { r.gpuExecutionAuthorized = true; }, r => { r.libdeviceReacquisitionAuthorized = true; }, r => { r.unrecognized = true; },
    r => { (r.artifacts as unknown[]).pop(); }, r => { r.nativeBunSnapshotRenewal = undefined; },
  ];
  for (const edit of edits) {
    const fake = fakeIO(requestMutation(snapshotFixture(), edit)); await expect(runFake(fake)).rejects.toThrow();
    expect(fake.events).toEqual(["inputs"]); noPass(fake);
  }
  const input = snapshotFixture(), haltedBytes = rawProofs[snapshotPaths.haltedRequest]!;
  const fake = fakeIO({ ...input, requestBytes: haltedBytes, binding: { ...reviewOf(input), requestSha256: sha256(haltedBytes) } });
  await expect(runFake(fake)).rejects.toThrow(); expect(fake.events).toEqual(["inputs"]);
});

test("review flags, hash, exact key membership and every current source fixture gate precede effects", async () => {
  for (const key of ["staticUnitTestsPassed", "staticTypesPassed", "securitySourceAccepted", "adversarialSourceAccepted", "devopsSourceAccepted"]) {
    const input = snapshotFixture(); reviewOf(input)[key] = false;
    const fake = fakeIO(input); await expect(runFake(fake)).rejects.toThrow("SNAPSHOT_SOURCE_ACCEPTANCE_REQUIRED"); expect(fake.events).toEqual(["inputs"]);
  }
  for (const path of reviewedFiles) {
    const input = snapshotFixture(); (input.evidence.files as Record<string, Uint8Array>)[path] = bytes("changed");
    const fake = fakeIO(input); await expect(runFake(fake)).rejects.toThrow("SNAPSHOT_BINDING_HASH_MISMATCH"); expect(fake.events).toEqual(["inputs"]);
  }
  const input = snapshotFixture(); (reviewOf(input).files as Record<string, string>).unrecognized = "a".repeat(64);
  await expect(runFake(fakeIO(input))).rejects.toThrow("SNAPSHOT_BINDING_MEMBERSHIP_REQUIRED");
});

test("all 69 historical proof and source-packet byte mutations reject even after rebinding their new hash", async () => {
  for (const path of proofPaths) {
    const input = snapshotFixture(), altered = bytes("{}");
    (input.evidence.predecessorProofs as Record<string, Uint8Array>)[path] = altered;
    (reviewOf(input).predecessorProofs as Record<string, string>)[path] = sha256(altered);
    const fake = fakeIO(input); await expect(runFake(fake)).rejects.toThrow(); expect(fake.events).toEqual(["inputs"]);
  }
});

test("failed-plan flags and the exact UID-1001 guard diagnosis cannot become kernel or native evidence", () => {
  for (const [path, edit] of [
    [snapshotPaths.failedReceipt, (r: Record<string, unknown>) => { r.nativeExecutableInvocations = 1; }],
    [snapshotPaths.failedReceipt, (r: Record<string, unknown>) => { r.status = "PASS"; }],
    [snapshotPaths.failedReceipt, (r: Record<string, unknown>) => { r.decompressionPerformed = true; }],
    [snapshotPaths.failureClassification, (r: Record<string, unknown>) => { r.namespaceCapabilityFailureEstablished = true; }],
    [snapshotPaths.ancestorDiagnosis, (r: Record<string, unknown>) => { ((r.files as Record<string, unknown>[])[3]!).uid = 0; }],
  ] as const) {
    const input = snapshotFixture(), record = parse(input.evidence.predecessorProofs[path]!); edit(record); const altered = json(record);
    (input.evidence.predecessorProofs as Record<string, Uint8Array>)[path] = altered;
    (reviewOf(input).predecessorProofs as Record<string, string>)[path] = sha256(altered);
    expect(() => validateSnapshotRenewal(input)).toThrow();
  }
});

test("held-FD capture orders source close, stage sync/chmod/sync/close, fresh verification and PASS-last hardlinks", async () => {
  const fake = fakeIO(); fake.setWriteLimit(1); fake.setReadLimit(2); const result = await runFake(fake);
  expect(result.status).toBe("PASS"); expect(result.byteLength).toBe(3); expect(result.sha256).toBe(sha256(bytes("abc")));
  expect(result.source.before).toEqual(result.source.after); expect(result.source.ancestorsBefore).toEqual(result.source.ancestorsAfter);
  expect(result.source.ancestorsBefore.find(a => a.path === "/usr/local/bin")!.identity.uid).toBe(1001);
  expect(fake.get(abs(snapshotPaths.pending))).toBe(fake.get(abs(snapshotPaths.destination)));
  expect(fake.get(abs(snapshotPaths.captureStage))).toBe(fake.get(abs(snapshotPaths.capture)));
  expect(fake.get(abs(snapshotPaths.destination)).data).toEqual(bytes("abc"));
  expect(fake.get(abs(snapshotPaths.destination)).identity.mode).toBe(0o100500); expect(fake.get(abs(snapshotPaths.attemptDirectory)).identity.mode).toBe(0o40700);
  expect(result.stagedIdentity.links).toBe(1); expect(result.finalIdentity.links).toBe(2);
  expect(result.finalIdentity.ctime).not.toBe(result.stagedIdentity.ctime);
  expect(result.finalIdentity.inode).toBe(result.stagedIdentity.inode); expect(result.finalIdentity.device).toBe(result.stagedIdentity.device);
  expect(fake.events.indexOf("open:operation")).toBeLessThan(fake.events.indexOf("mkdir:attempt"));
  expect(fake.events.indexOf("mkdir:attempt")).toBeLessThan(fake.events.indexOf("open:source"));
  const ordered = ["close:source", "sync:pending", "chmod:pending:500", "sync:pending", "close:pending", "open:pending", "close:pending", "link:final", "open:final", "close:final",
    "open:receipt-stage", "write:receipt-stage:0", "sync:receipt-stage", "close:receipt-stage", "link:receipt"];
  let position = -1;
  for (const event of ordered) { const next = fake.events.indexOf(event, position + 1); expect(next).toBeGreaterThan(position); position = next; }
  expect(fake.calls.filter(c => c.op === "write" && c.path === abs(snapshotPaths.pending)).map(c => c.position)).toEqual([0, 1, 2]);
  expect(fake.calls.filter(c => c.op === "read").every(c => c.length! <= 65536 && Number.isInteger(c.position))).toBe(true);
  for (const call of fake.calls.filter(c => c.op === "open")) {
    expect(call.flags! & constants.O_NOFOLLOW).not.toBe(0); expect(call.flags! & constants.O_NONBLOCK).not.toBe(0);
    if (call.mode !== undefined) { expect(call.mode).toBe(0o600); expect(call.flags! & constants.O_EXCL).not.toBe(0); }
  }
  const receipt = parse(fake.get(abs(snapshotPaths.capture)).data);
  expect(receipt).toEqual(result); expect(receipt.fileSyncOnly).toBe(true); expect(receipt.directoryDurabilityEstablished).toBe(false);
  expect(receipt.atomicMountCustodyEstablished).toBe(false); expect(receipt.outerBootstrapTrust).toBe((expectedRenewal().nativeBunSnapshot as Record<string, unknown>).outerBootstrapTrust);
  for (const key of ["buildIsolationQualified", "custodyQualified", "llvmCodeExecuted", "cudaCompilationEstablished", "actualHostExecuted", "cudaGpuCodeExecuted", "trainingReady"]) expect(receipt[key]).toBe(false);
  expect(fake.events.at(-1)).toBe("link:receipt");
});

test("public capture cannot override the fixed 80,761,952-byte production identity with a small fixture", async () => {
  const fake = fakeIO(); await expect(captureBunSnapshot(["capture"], fake.io)).rejects.toThrow("SNAPSHOT_FILE_IDENTITY_REJECTED");
  expect(fake.events).not.toContain("open:pending"); noPass(fake);
});

test("source reads enforce undersize, pre-write overrun and digest limits without retaining unbounded data", async () => {
  for (const [data, code] of [["ab", "SOURCE_SNAPSHOT_LENGTH_MISMATCH"], ["abcd", "SOURCE_SNAPSHOT_BYTE_LIMIT"], ["abd", "SOURCE_SNAPSHOT_DIGEST_MISMATCH"]]) {
    const fake = fakeIO(); fake.get(snapshotPaths.source).data = bytes(data!);
    await expect(runFake(fake)).rejects.toThrow(code); noPass(fake);
    expect(fake.nodes.has(abs(snapshotPaths.operation))).toBe(true); expect(fake.nodes.has(abs(snapshotPaths.pending))).toBe(true);
    if (data === "abcd") { expect(fake.get(abs(snapshotPaths.pending)).data.byteLength).toBe(0); expect(fake.events.some(e => e.startsWith("write:pending:"))).toBe(false); }
    expect(fake.events).toContain("close:source"); expect(fake.events).toContain("close:pending"); expect(fake.events).not.toContain("link:final");
  }
});

test("zero or invalid partial writes fail instead of looping, with both owned descriptors closed", async () => {
  const fake = fakeIO(); fake.setWriteLimit(0);
  await expect(runFake(fake)).rejects.toThrow("SNAPSHOT_PARTIAL_WRITE_FAILED");
  expect(fake.events).not.toContain("mkdir:attempt"); noPass(fake);
  const staged = fakeIO(); staged.setHook(event => { if (event === "open:pending") staged.setWriteLimit(0); });
  await expect(runFake(staged)).rejects.toThrow("SNAPSHOT_PARTIAL_WRITE_FAILED"); expect(staged.events).toContain("close:source"); expect(staged.events).toContain("close:pending"); noPass(staged);
});

test("only the source capture read admits exactly canonical /usr/local/bin UID/GID 1001 mode 0755", async () => {
  const fake = fakeIO(); await expect(snapshotTestOnly.ancestors(snapshotPaths.source, fake.io, true)).resolves.toHaveLength(4);
  await expect(snapshotTestOnly.ancestors(snapshotPaths.source, fake.io)).rejects.toThrow("UNTRUSTED_SNAPSHOT_ANCESTOR");
  for (const [path, edit] of [
    ["/usr/local/bin", { gid: 1002 }], ["/usr/local/bin", { uid: 1002 }], ["/usr/local/bin", { mode: 0o40775 }],
    ["/usr/local/bin", { mode: 0o40750 }], ["/usr/local", { uid: 1001 }], ["/usr", { mode: 0o40777 }], ["/usr/local/bin", { mode: 0o120755 }],
  ] as const) {
    const bad = fakeIO(); changeStat(bad, path, edit); await expect(runFake(bad)).rejects.toThrow("UNTRUSTED_SNAPSHOT_ANCESTOR");
    expect(bad.events).not.toContain("open:source"); noPass(bad);
  }
  const alias = fakeIO(); alias.realPaths.set("/usr/local/bin", "/elsewhere"); await expect(runFake(alias)).rejects.toThrow("UNTRUSTED_SNAPSHOT_ANCESTOR");
  await expect(snapshotTestOnly.ancestors("/usr/local/bin/other", fake.io, true)).rejects.toThrow("UNTRUSTED_SNAPSHOT_ANCESTOR");
});

test("source must be canonical root-owned regular 0755 with the exact length before pending opens", async () => {
  for (const changes of [{ uid: 1000 }, { mode: 0o100775 }, { mode: 0o1004755 }, { mode: 0o40755 }, { mode: 0o120755 }, { bytes: 2 }, { bytes: 4 }]) {
    const fake = fakeIO(); changeStat(fake, snapshotPaths.source, changes); await expect(runFake(fake)).rejects.toThrow();
    expect(fake.events).not.toContain("open:pending"); noPass(fake);
  }
  const fake = fakeIO(); fake.realPaths.set(snapshotPaths.source, "/other/bun"); await expect(runFake(fake)).rejects.toThrow("SNAPSHOT_FD_PATH_MISMATCH");
});

test("source FD, pathname and original ancestor identity changes fail before sealing or publication", async () => {
  for (const change of ["fd", "path", "ancestor", "canonical"] as const) {
    const fake = fakeIO(); let done = false;
    fake.setHook(event => {
      if (!done && event === "read:source:0") {
        done = true;
        if (change === "fd") changeStat(fake, snapshotPaths.source, { ctime: "changed" });
        if (change === "path") fake.nodes.set(snapshotPaths.source, { identity: { ...fake.get(snapshotPaths.source).identity, inode: "new" }, data: bytes("abc") });
        if (change === "ancestor") changeStat(fake, "/usr/local/bin", { inode: "new" });
        if (change === "canonical") fake.realPaths.set("/usr/local/bin", "/elsewhere");
      }
    });
    await expect(runFake(fake)).rejects.toThrow(); noPass(fake); expect(fake.events).not.toContain("sync:pending");
  }
});

test("operation, source, write, sync, chmod, close, reopen, publication and final verification failures never publish PASS", async () => {
  const points: [string, number][] = [["open:operation", 1], ["write:operation:0", 1], ["sync:operation", 1], ["close:operation", 1],
    ["mkdir:attempt", 1], ["open:source", 1], ["open:pending", 1], ["read:source:0", 1], ["write:pending:0", 1], ["close:source", 1],
    ["sync:pending", 1], ["chmod:pending:500", 1], ["sync:pending", 2], ["close:pending", 1], ["open:pending", 2],
    ["read:pending:0", 1], ["close:pending", 2], ["link:final", 1], ["open:final", 1], ["read:final:0", 1], ["close:final", 1],
    ["open:receipt-stage", 1], ["write:receipt-stage:0", 1], ["sync:receipt-stage", 1], ["close:receipt-stage", 1], ["link:receipt", 1]];
  for (const [point, occurrence] of points) {
    const fake = fakeIO(), failure = Error(`FAIL_${point}_${occurrence}`); fake.failAt(point, failure, occurrence);
    expect(await rejection(runFake(fake))).toBe(failure); noPass(fake);
    if (point !== "open:operation") expect(fake.nodes.has(abs(snapshotPaths.operation))).toBe(true);
    if (point === "close:source") expect(fake.events).not.toContain("link:final");
    if (point === "sync:receipt-stage" || point === "close:receipt-stage") expect(fake.events).not.toContain("link:receipt");
  }
});

test("first failure survives source and stage cleanup errors, including an empty-string first failure", async () => {
  for (const failure of [Error("FIRST_WRITE_FAILURE"), "", undefined, null]) {
    const fake = fakeIO(); fake.setHook(event => {
      if (event === "write:pending:0") throw failure;
      if (event === "close:source" || event === "close:pending") throw Error("LATER_CLOSE_FAILURE");
    });
    expect(await rejection(runFake(fake))).toBe(failure); noPass(fake);
    expect(fake.events.filter(e => e === "close:source")).toHaveLength(1); expect(fake.events.filter(e => e === "close:pending")).toHaveLength(1);
  }
  const fake = fakeIO(); fake.setHook(event => { if (event === "sync:receipt-stage") throw ""; if (event === "close:receipt-stage") throw Error("LATER_CLOSE"); });
  expect(await rejection(runFake(fake))).toBe(""); noPass(fake); expect(fake.events).not.toContain("link:receipt");
});

test("existing attempt directories, identical destinations, operation markers and consumed successful captures never replay", async () => {
  for (const finalPresent of [false, true]) {
    const fake = fakeIO(); fake.addDirectory(abs(snapshotPaths.attemptDirectory), 0o40700);
    if (finalPresent) fake.addFile(abs(snapshotPaths.destination), bytes("abc"), 0o100500);
    await expect(runFake(fake)).rejects.toThrow("EEXIST"); noPass(fake); expect(fake.events).not.toContain("open:source");
    if (finalPresent) expect(fake.get(abs(snapshotPaths.destination)).data).toEqual(bytes("abc"));
  }
  const fake = fakeIO(); await runFake(fake); const writes = fake.calls.filter(c => ["write", "mkdir", "link"].includes(c.op)).length;
  await expect(runFake(fake)).rejects.toThrow("EEXIST"); expect(fake.calls.filter(c => ["write", "mkdir", "link"].includes(c.op))).toHaveLength(writes);
  expect(fake.get(abs(snapshotPaths.destination)).data).toEqual(bytes("abc"));
});

test("an independently appearing final path rejects exclusive publication even with identical bytes", async () => {
  const fake = fakeIO(); fake.setHook(event => { if (event === "link:final") fake.addFile(abs(snapshotPaths.destination), bytes("abc"), 0o100500); });
  await expect(runFake(fake)).rejects.toThrow("EEXIST"); noPass(fake);
  expect(fake.get(abs(snapshotPaths.destination))).not.toBe(fake.get(abs(snapshotPaths.pending)));
});

test("cache, outside-created run and destination ancestors require canonical private current-UID placement without the capture exception", async () => {
  for (const [path, changes] of [[abs(snapshotPaths.cache), { mode: 0o40755 }], [abs(snapshotPaths.cache), { uid: 0 }],
    [abs(snapshotPaths.runDirectory), { mode: 0o40750 }], [abs(snapshotPaths.runDirectory), { uid: 1001 }], [abs(`${"_work/gpu-owner-recovery"}`), { uid: 1001 }]] as const) {
    const fake = fakeIO(); changeStat(fake, path, changes); await expect(runFake(fake)).rejects.toThrow(); noPass(fake);
    expect(fake.events).not.toContain("open:operation"); expect(fake.events).not.toContain("mkdir:attempt");
  }
  const missing = fakeIO(); missing.nodes.delete(abs(snapshotPaths.runDirectory)); await expect(runFake(missing)).rejects.toThrow("ENOENT");
  expect(missing.events).not.toContain("mkdir:attempt");
  const alias = fakeIO(); alias.realPaths.set(abs(snapshotPaths.cache), "/other/cache"); await expect(runFake(alias)).rejects.toThrow();
  const badAttempt = fakeIO(); badAttempt.setHook(event => { if (event === "open:source") changeStat(badAttempt, abs(snapshotPaths.attemptDirectory), { uid: 1001 }); });
  await expect(runFake(badAttempt)).rejects.toThrow(); noPass(badAttempt);
});

test("ordinary root/current-owned non-writable sticky ancestors retain the accepted directory policy", async () => {
  const fake = fakeIO(); changeStat(fake, abs(".."), { mode: 0o41755 }); changeStat(fake, "/usr", { mode: 0o41755 });
  expect((await runFake(fake)).status).toBe("PASS");
  const writable = fakeIO(); changeStat(writable, abs(".."), { mode: 0o41777 }); await expect(runFake(writable)).rejects.toThrow("UNTRUSTED_SNAPSHOT_ANCESTOR"); noPass(writable);
});

test("staged mode, inode, owner, byte and ancestor mutations block hardlink publication", async () => {
  for (const change of ["mode", "inode", "uid", "bytes", "ancestor"] as const) {
    const fake = fakeIO(); let opens = 0;
    fake.setHook(event => {
      if (event === "open:pending" && ++opens === 2) {
        if (change === "mode") changeStat(fake, abs(snapshotPaths.pending), { mode: 0o100600 });
        if (change === "inode") changeStat(fake, abs(snapshotPaths.pending), { inode: "changed" });
        if (change === "uid") changeStat(fake, abs(snapshotPaths.pending), { uid: 0 });
        if (change === "bytes") fake.get(abs(snapshotPaths.pending)).data = bytes("abd");
        if (change === "ancestor") changeStat(fake, abs(snapshotPaths.attemptDirectory), { mode: 0o40755 });
      }
    });
    await expect(runFake(fake)).rejects.toThrow(); expect(fake.events).not.toContain("link:final"); noPass(fake);
  }
});

test("post-verification pending replacement and changed fresh authority block publication", async () => {
  for (const change of ["pending", "authority"] as const) {
    const fake = fakeIO(); let reads = 0;
    fake.setHook(event => { if (event === "inputs" && ++reads === 2) {
      if (change === "pending") changeStat(fake, abs(snapshotPaths.pending), { inode: "changed" });
      else fake.setInput(requestMutation(snapshotFixture(), r => { r.authorityGranted = false; }));
    } });
    await expect(runFake(fake)).rejects.toThrow(); expect(fake.events).not.toContain("link:final"); noPass(fake);
  }
});

test("final fresh hash, mode, link identity, FD/path and ancestor checks precede evidence creation", async () => {
  for (const change of ["bytes", "mode", "separate-inode", "ancestor", "fd-path"] as const) {
    const fake = fakeIO(); let done = false;
    fake.setHook(event => {
      if (event === "open:final" && !done) {
        done = true;
        if (change === "bytes") fake.get(abs(snapshotPaths.destination)).data = bytes("abd");
        if (change === "mode") changeStat(fake, abs(snapshotPaths.destination), { mode: 0o100700 });
        if (change === "separate-inode") fake.nodes.set(abs(snapshotPaths.destination), { identity: { ...fake.get(abs(snapshotPaths.pending)).identity, inode: "other" }, data: bytes("abc") });
        if (change === "ancestor") changeStat(fake, abs(snapshotPaths.attemptDirectory), { uid: 1001 });
      }
      if (change === "fd-path" && event === "read:final:0") fake.nodes.set(abs(snapshotPaths.destination), { identity: { ...fake.get(abs(snapshotPaths.pending)).identity, inode: "other" }, data: bytes("abc") });
    });
    await expect(runFake(fake)).rejects.toThrow(); expect(fake.events).not.toContain("open:receipt-stage"); noPass(fake);
  }
});

test("a false two-copy link adapter cannot satisfy the same-inode publication contract", async () => {
  const fake = fakeIO(), actual = fake.io.link;
  const io = { ...fake.io, async link(from: string, to: string) {
    await actual(from, to);
    if (to === abs(snapshotPaths.destination)) fake.nodes.set(to, { identity: { ...fake.get(from).identity, inode: "copied" }, data: fake.get(from).data.slice() });
  } };
  await expect(snapshotTestOnly.capture(io)).rejects.toThrow("SNAPSHOT_HARDLINK_IDENTITY_REQUIRED"); noPass(fake);
});

test("small proof adapter handles exact bounded regular inputs with no source-ancestor exception", async () => {
  const fake = fakeIO(), path = abs(`${"_work/gpu-owner-recovery/"}scratch/snapshot-small.source`); fake.addFile(path, bytes("abc")); fake.setReadLimit(1);
  expect(await snapshotTestOnly.readSmall(path, fake.io)).toEqual(bytes("abc"));
  expect(fake.calls.filter(c => c.op === "read" && c.path === path).map(c => c.position)).toEqual([0, 1, 2, 3]);
  expect(fake.events).toContain(`close:${path}`);
  await expect(snapshotTestOnly.readSmall(snapshotPaths.source, fake.io)).rejects.toThrow("UNTRUSTED_SNAPSHOT_ANCESTOR");
  for (const changes of [{ mode: 0o100666 }, { uid: 1001 }, { bytes: 1048577 }, { mode: 0o10600 }, { mode: 0o120600 }]) {
    const bad = fakeIO(); bad.addFile(path, bytes("abc")); changeStat(bad, path, changes); await expect(snapshotTestOnly.readSmall(path, bad.io)).rejects.toThrow();
  }
});

test("small proof adapter enforces FD/path, overrun, changing ancestors and first close-failure ordering", async () => {
  const path = abs(`${"_work/gpu-owner-recovery/"}scratch/snapshot-small.source`);
  for (const change of ["path", "overrun", "ancestor"] as const) {
    const fake = fakeIO(); fake.addFile(path, bytes("abc"));
    if (change === "overrun") fake.get(path).data = bytes("abcd");
    else fake.setHook(event => { if (event === `read:${path}:0`) {
      if (change === "path") fake.nodes.set(path, { identity: { ...fake.get(path).identity, inode: "changed" }, data: bytes("abc") });
      else changeStat(fake, dirname(path), { mtime: "changed" });
    } });
    await expect(snapshotTestOnly.readSmall(path, fake.io)).rejects.toThrow(); expect(fake.events).toContain(`close:${path}`);
  }
  const fake = fakeIO(); fake.addFile(path, bytes("abc")); fake.setHook(event => { if (event === `read:${path}:0`) throw ""; if (event === `close:${path}`) throw Error("LATER"); });
  expect(await rejection(snapshotTestOnly.readSmall(path, fake.io))).toBe("");
});

test("readSnapshotInputs uses the fixed complete binding lists through the bounded read-only adapter", async () => {
  const input = snapshotFixture(), fake = fakeIO();
  for (const [path, data] of Object.entries({ ...input.evidence.files, ...input.evidence.predecessorProofs,
    [snapshotPaths.request]: input.requestBytes, [snapshotPaths.binding]: json(input.binding) })) fake.addFile(abs(path), data);
  const result = await readSnapshotInputs(fake.io); validateSnapshotRenewal(result);
  expect(fake.calls.filter(c => c.op === "open")).toHaveLength(reviewedFiles.length + proofPaths.length + 2);
  expect(fake.calls.filter(c => c.op === "open").every(c => c.flags === (constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK))).toBe(true);
  expect(fake.calls.some(c => ["write", "mkdir", "link", "chmod", "sync"].includes(c.op))).toBe(false);
  expect(fake.calls.some(c => c.path === snapshotPaths.source)).toBe(false);
});

test("snapshot tasks-only config requires exact raw TOML and the private environment changes only the filename", () => {
  validateSnapshotTaskConfiguration(config); expect(snapshotEnvironment()).toEqual({ ...environment, MISE_OVERRIDE_CONFIG_FILENAMES: "cuda-bun-snapshot-mise.toml" });
  expect(snapshotEnvironment()).not.toBe(environment);
  for (const changed of [bytes(new TextDecoder().decode(config) + "\n"), bytes(new TextDecoder().decode(config).replace("capture", "audit")),
    bytes(new TextDecoder().decode(config) + "[tools]\nbun='latest'\n"), bytes("[tasks.x]\nrun='echo hi'\n")]) expect(() => validateSnapshotTaskConfiguration(changed)).toThrow();
  for (const key of ["HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy", "NO_PROXY", "no_proxy"]) expect(snapshotEnvironment()[key]).toBeUndefined();
});

function miseFake() {
  const events: string[] = []; const io: TrustedSnapshotMiseIO = {
    async verifyOutsideGate() { events.push("gate"); }, async readTaskConfiguration() { events.push("raw-config"); return config; },
    async run(stage) { events.push(stage.name); return { exitCode: 0, stdout: stage.name === "01-config" ? json([{ path: abs(snapshotPaths.taskConfiguration), tools: [] }]) : new Uint8Array() }; },
  }; return { io, events };
}
test("Mise's exported consumer gates exact-leaf trust, sole discovery and only the fixed capture task", async () => {
  expect(snapshotStagePlan()).toEqual([
    { name: "00-trust", argv: ["/usr/local/bin/mise", "trust", abs(snapshotPaths.taskConfiguration)] },
    { name: "01-config", argv: ["/usr/local/bin/mise", "config", "ls", "--json"] },
    { name: "02-capture", argv: ["/usr/local/bin/mise", "run", "--raw", "cuda:capture-audit-bun"] },
  ]);
  const fake = miseFake(); expect(await runSnapshotMiseStages(fake.io)).toEqual({ exitCode: 0, failedStage: null, completedStages: ["00-trust", "01-config", "02-capture"] });
  expect(fake.events).toEqual(["gate", "raw-config", "00-trust", "gate", "gate", "raw-config", "01-config", "gate", "gate", "raw-config", "02-capture", "gate"]);
});

test("every Mise failure, including empty failure text, stops without discovery, capture, retries or fallback", async () => {
  for (const stage of snapshotStagePlan()) for (const failure of ["", "FAILED", null]) {
    const fake = miseFake(), actual = fake.io.run;
    const result = await runSnapshotMiseStages({ ...fake.io, async run(selected) {
      const result = await actual(selected); return selected.name === stage.name ? { ...result, failure, exitCode: failure === null ? 1 : 0 } : result;
    } });
    expect(result.failedStage).toBe(stage.name); expect(result.exitCode).toBe(1);
    expect(fake.events.filter(e => e.startsWith("0"))).toHaveLength(snapshotStagePlan().findIndex(s => s.name === stage.name) + 1);
  }
  for (const exitCode of [-1, 256, 0.5, NaN]) await expect(runSnapshotMiseStages({ ...miseFake().io, run: async () => ({ exitCode, stdout: new Uint8Array() }) })).rejects.toThrow("INVALID_MISE_STAGE_EXIT");
  const fake = miseFake(); await expect(runSnapshotMiseStages({ ...fake.io, verifyOutsideGate: async () => { throw ""; } })).rejects.toBe(""); expect(fake.events).toEqual([]);
});

test("Mise discovery rejects ambient configs, tools, malformed and extra results before capture", async () => {
  for (const data of [json([]), json({ path: abs(snapshotPaths.taskConfiguration) }), json([{ path: abs("mise.toml") }]),
    json([{ path: abs(snapshotPaths.taskConfiguration), tools: ["bun"] }]), json([{ path: abs(snapshotPaths.taskConfiguration) }, { path: "/other" }]), bytes("{"), new Uint8Array(65537)]) {
    expect(() => validateSnapshotMiseDiscovery(data)).toThrow();
    const fake = miseFake(), actual = fake.io.run;
    await expect(runSnapshotMiseStages({ ...fake.io, async run(stage) { const result = await actual(stage); return stage.name === "01-config" ? { ...result, stdout: data } : result; } })).rejects.toThrow();
    expect(fake.events).not.toContain("02-capture");
  }
});

test("snapshot source has no native child, network, archive imports, general installer, retries, timers or cleanup", () => {
  const source = new TextDecoder().decode(rawFiles[`${"_work/gpu-owner-recovery/"}cuda-bun-snapshot.ts`]!);
  expect(source).not.toMatch(/(?:from\s+["']\.\/cuda-archive|import\(["']\.\/cuda-archive|Bun\.spawn|child_process|\bfetch\s*\(|setTimeout|setInterval|\bunlink\s*\(|\brm\s*\(|readFile\s*\()/);
  expect(source).not.toContain("process.env"); expect(source).not.toContain("recursive: true"); expect(source).not.toContain("console.log");
  expect(snapshotLimits).toEqual({ proofBytes: 1048576, chunkBytes: 65536, wholeInvocationMs: 30000 });
  expect(snapshotFailureCode("")).toBe("BUN_SNAPSHOT_FAILED"); expect(snapshotFailureCode(Error("UNTRUSTED_SNAPSHOT_ANCESTOR"))).toBe("UNTRUSTED_SNAPSHOT_ANCESTOR");
});

function completedFixture(): Record<string, Uint8Array> {
  return Object.fromEntries(Object.entries(rawCompletedProofs).map(([path, data]) => [path, data.slice()]));
}
function refreshVerificationReferences(proofs: Record<string, Uint8Array>): void {
  const verification = parse(proofs[`${completedRun}verification.json`]!);
  verification.outsideReceiptSha256 = sha256(proofs[`${completedRun}receipt.json`]!);
  verification.captureReceiptSha256 = sha256(proofs[snapshotPaths.capture]!);
  proofs[`${completedRun}verification.json`] = json(verification);
}
function editCompleted(proofs: Record<string, Uint8Array>, path: string, edit: (record: Record<string, unknown>) => void): void {
  const record = parse(proofs[path]!); edit(record); proofs[path] = json(record);
  if (path === snapshotPaths.capture || path === `${completedRun}receipt.json`) refreshVerificationReferences(proofs);
}
function bindCompletedStream(proofs: Record<string, Uint8Array>, stream: "stdout" | "stderr", data: Uint8Array): void {
  const path = `${completedRun}command.${stream}`; proofs[path] = data;
  editCompleted(proofs, `${completedRun}receipt.json`, receipt => {
    receipt[`${stream}Bytes`] = data.byteLength;
    const entry = (receipt.streams as Record<string, unknown>[]).find(item => item.stream === stream)!;
    entry.bytes = data.byteLength; entry.sha256 = sha256(data);
  });
}
function expectedPostCapture(): Record<string, unknown> {
  const approved = parse(rawCompletedProofs[`${completedRun}approved-request.json`]!);
  return { ...approved, status: "APPROVED_SEQUENCE_IN_PROGRESS_AFTER_PRIVATE_BUN_CAPTURE", phase: "PRIVATE_BUN_CAPTURED_ARCHIVE_V2_SOURCE_GATES_PENDING",
    nativeBunSnapshot: { ...approved.nativeBunSnapshot as object, grantStatus: "CONSUMED_SUCCESS" },
    nativeBunSnapshotResult: { status: "PASS", outsideReceipt: "_work/gpu-owner-recovery/runs/cuda-bun-snapshot-1/receipt.json",
      captureReceipt: "_work/gpu-owner-recovery/runs/cuda-bun-snapshot-1/capture.json", verification: "_work/gpu-owner-recovery/runs/cuda-bun-snapshot-1/verification.json",
      approvedRequestCapture: "_work/gpu-owner-recovery/runs/cuda-bun-snapshot-1/approved-request.json", sourceReview: "_work/gpu-owner-recovery/cuda-bun-snapshot-reviewed.json",
      sourceSnapshot: "_work/gpu-owner-recovery/runs/cuda-bun-snapshot-1/source-snapshot.json", privateSnapshotExecuted: false } };
}

test("completed snapshot authenticator uses exactly 97 fixed proofs and the executed 18-file packet, not current helper hashes", () => {
  expect(completedSnapshotPins).toEqual({ approvedRequest: "e4a2dca4aa4f0cd9b463f40400912299f16765339723f1a6b371cb11da03150a",
    review: "780a907710d5a934c5f02414db2bedfb91d56d7cc97fd6badf6015bfcf8f58ce" });
  expect(completedSnapshotProofPaths).toEqual([...proofPaths, `${completedRun}approved-request.json`, snapshotPaths.binding, `${completedRun}source-review.json`,
    `${completedRun}receipt.json`, snapshotPaths.capture, `${completedRun}verification.json`, snapshotPaths.operation,
    `${completedRun}command.stdout`, `${completedRun}command.stderr`, `${completedRun}source-snapshot.json`, ...completedSourcePaths]);
  expect(completedSnapshotProofPaths).toHaveLength(97); expect(new Set(completedSnapshotProofPaths).size).toBe(97);
  expect(Object.isFrozen(completedSnapshotProofPaths)).toBe(true); expect(Object.isFrozen(completedSnapshotPins)).toBe(true);
  expect(completedSnapshotProofPaths).not.toContain(snapshotPaths.source); expect(completedSnapshotProofPaths).not.toContain(snapshotIdentity.destination);
  const proofs: CompletedSnapshotProofs = completedFixture(), capture = validateSnapshotReceipt(proofs);
  expect(parse(proofs[snapshotPaths.capture]!)).toEqual(capture); expect(capture.byteLength).toBe(80761952); expect(capture.sha256).toBe(snapshotIdentity.sha256);
  expect(capture.requestSha256).toBe(completedSnapshotPins.approvedRequest); expect(capture.sourceReviewCanonicalSha256).not.toBe(completedSnapshotPins.review);
  expect(capture.stagedIdentity.links).toBe(1); expect(capture.finalIdentity.links).toBe(2);
  expect(capture.stagedIdentity.ctime).not.toBe(capture.finalIdentity.ctime); expect(capture.stagedIdentity.inode).toBe(capture.finalIdentity.inode);
  expect(sha256(proofs[completedSourcePaths[15]!]!)).not.toBe(sha256(rawFiles["_work/gpu-owner-recovery/cuda-bun-snapshot.ts"]!));
  expect(sha256(proofs[completedSourcePaths[16]!]!)).not.toBe(sha256(rawFiles["_work/gpu-owner-recovery/cuda-bun-snapshot.test.ts"]!));
  expect(Object.values(proofs).every(data => data.byteLength <= 1048576)).toBe(true);
});

test("completed proof membership rejects missing, extra, renamed, non-byte, empty and oversized inputs before parsing", () => {
  const missing = completedFixture(); delete missing[completedSourcePaths[0]!]; expect(() => validateSnapshotReceipt(missing)).toThrow("COMPLETED_SNAPSHOT_PROOF_MEMBERSHIP_REQUIRED");
  const extra = completedFixture(); extra["unselected.json"] = bytes("{}"); expect(() => validateSnapshotReceipt(extra)).toThrow("COMPLETED_SNAPSHOT_PROOF_MEMBERSHIP_REQUIRED");
  const symbol = completedFixture(); Object.defineProperty(symbol, Symbol("unselected"), { value: bytes("{}") });
  expect(() => validateSnapshotReceipt(symbol)).toThrow("COMPLETED_SNAPSHOT_PROOF_MEMBERSHIP_REQUIRED");
  const renamed = completedFixture(); renamed["unselected.source"] = renamed[completedSourcePaths[0]!]!; delete renamed[completedSourcePaths[0]!];
  expect(() => validateSnapshotReceipt(renamed)).toThrow("COMPLETED_SNAPSHOT_PROOF_MEMBERSHIP_REQUIRED");
  for (const value of [new Uint8Array(), new Uint8Array(1048577), "{}", {}, null]) {
    const proofs = completedFixture(); (proofs as Record<string, unknown>)[completedSourcePaths[0]!] = value;
    expect(() => validateSnapshotReceipt(proofs)).toThrow("BOUNDED_COMPLETED_SNAPSHOT_PROOF_REQUIRED");
  }
});

test("every completed proof mutation rejects after refreshing unpinned outer references where applicable", () => {
  for (const path of completedSnapshotProofPaths) {
    const proofs = completedFixture(); proofs[path] = bytes("{}");
    if (proofPaths.includes(path)) editCompleted(proofs, `${completedRun}receipt.json`, record => {
      (record.predecessorProofs as Record<string, unknown>)[path] = sha256(proofs[path]!);
    });
    const sourceIndex = completedSourcePaths.indexOf(path);
    if (sourceIndex !== -1) editCompleted(proofs, `${completedRun}receipt.json`, record => {
      (record.reviewedFiles as Record<string, unknown>)[reviewedFiles[sourceIndex]!] = sha256(proofs[path]!);
    });
    if (path === `${completedRun}command.stdout`) bindCompletedStream(proofs, "stdout", proofs[path]!);
    if (path === `${completedRun}command.stderr`) bindCompletedStream(proofs, "stderr", proofs[path]!);
    if (path === `${completedRun}receipt.json` || path === snapshotPaths.capture) refreshVerificationReferences(proofs);
    expect(() => validateSnapshotReceipt(proofs)).toThrow();
  }
});

test("raw approved-request and both review-copy pins reject semantic-equivalent re-encoding and changed acceptance flags", () => {
  for (const path of [`${completedRun}approved-request.json`, snapshotPaths.binding, `${completedRun}source-review.json`]) {
    const proofs = completedFixture(); proofs[path] = json(parse(proofs[path]!));
    expect(() => validateSnapshotReceipt(proofs)).toThrow("PINNED_COMPLETED_SNAPSHOT_REQUIRED");
  }
  for (const key of ["staticUnitTestsPassed", "staticTypesPassed", "adversarialSourceAccepted", "securitySourceAccepted", "devopsSourceAccepted", "unknown"]) {
    const proofs = completedFixture(), review = parse(proofs[snapshotPaths.binding]!); review[key] = false;
    proofs[snapshotPaths.binding] = json(review); proofs[`${completedRun}source-review.json`] = json(review);
    expect(() => validateSnapshotReceipt(proofs)).toThrow("PINNED_COMPLETED_SNAPSHOT_REQUIRED");
  }
  const proofs = completedFixture(); editCompleted(proofs, snapshotPaths.capture, capture => { capture.sourceReviewCanonicalSha256 = completedSnapshotPins.review; });
  expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SNAPSHOT_CAPTURE_REQUIRED");
});

test("completed source manifest authenticates exact before-invocation timing, file order, fixed paths, lengths and hashes", () => {
  const edits: ((record: Record<string, unknown>) => void)[] = [
    record => { record.captureTiming = "AFTER_CAPTURE"; }, record => { (record.files as unknown[]).reverse(); }, record => { (record.files as unknown[]).pop(); },
    record => { ((record.files as Record<string, unknown>[])[0]!).path = "_work/gpu-owner-recovery/cuda-archive.ts"; },
    record => { ((record.files as Record<string, unknown>[])[0]!).snapshot = "unselected.source"; },
    record => { ((record.files as Record<string, unknown>[])[0]!).bytes = "15049"; },
    record => { ((record.files as Record<string, unknown>[])[0]!).sha256 = "0".repeat(64); },
    record => { ((record.files as Record<string, unknown>[])[0]!).unknown = false; }, record => { record.unknown = false; },
  ];
  for (const edit of edits) {
    const proofs = completedFixture(); editCompleted(proofs, `${completedRun}source-snapshot.json`, edit);
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SOURCE_PACKET_REQUIRED");
  }
  for (const edit of [(record: Record<string, unknown>) => { record.sequence = "cuda-bun-snapshot-2"; },
    (record: Record<string, unknown>) => { record.unknown = true; }]) {
    const proofs = completedFixture(); editCompleted(proofs, snapshotPaths.operation, edit);
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SNAPSHOT_OPERATION_REQUIRED");
  }
});

test("completed invocation rejects changed authority pins, source maps, execution flags, deadline, consumer or unknown fields", () => {
  const edits: ((record: Record<string, unknown>) => void)[] = [
    r => { r.status = "FAIL"; }, r => { r.exitCode = "0"; }, r => { r.failure = ""; }, r => { r.sourceChanged = true; },
    r => { r.pinnedRequestSha256 = "0".repeat(64); }, r => { r.pinnedReviewSha256 = "0".repeat(64); },
    r => { (r.reviewedFiles as Record<string, unknown>)[reviewedFiles[0]!] = "0".repeat(64); },
    r => { (r.predecessorProofs as Record<string, unknown>)[proofPaths[0]!] = "0".repeat(64); },
    r => { r.oneOutsideDeadlineMs = 30001; }, r => { r.stageConsumer = "other"; }, r => { r.sourceCaptureReadExceptionOnly = false; },
    r => { r.outerBootstrapTrustRetained = false; }, r => { r.unknown = true; }, r => { (r.environment as Record<string, unknown>).HTTP_PROXY = "http://invalid.test"; },
  ];
  for (const key of ["privateSnapshotExecuted", "extractionPerformed", "llvmCodeExecuted", "buildIsolationQualified", "custodyQualified", "cudaCompilationEstablished",
    "actualHostExecuted", "cudaGpuCodeExecuted", "trainingReady"]) edits.push(r => { r[key] = true; });
  for (const edit of edits) {
    const proofs = completedFixture(); editCompleted(proofs, `${completedRun}receipt.json`, edit);
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SNAPSHOT_INVOCATION_REQUIRED");
  }
  const argv = completedFixture(); editCompleted(argv, `${completedRun}receipt.json`, r => { (r.argv as string[])[0] = "/other/bun"; });
  expect(() => validateSnapshotReceipt(argv)).toThrow("COMPLETED_SNAPSHOT_OUTER_ARGV_REQUIRED");
});

test("completed raw streams require exact identities, byte counts and successful fixed-stage order", () => {
  for (const edit of [
    (r: Record<string, unknown>) => { r.stdoutBytes = 0; }, (r: Record<string, unknown>) => { r.stderrBytes = "83"; },
    (r: Record<string, unknown>) => { ((r.streams as Record<string, unknown>[])[0]!).sha256 = "0".repeat(64); },
    (r: Record<string, unknown>) => { ((r.streams as Record<string, unknown>[])[1]!).path = "other.stderr"; },
  ]) {
    const proofs = completedFixture(); editCompleted(proofs, `${completedRun}receipt.json`, edit);
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SNAPSHOT_STREAMS_REQUIRED");
  }
  for (const edit of [
    (frames: Record<string, unknown>[]) => { frames.reverse(); },
    (frames: Record<string, unknown>[]) => { frames[1]!.exitCode = 1; },
    (frames: Record<string, unknown>[]) => { frames[3]!.failure = ""; },
    (frames: Record<string, unknown>[]) => { (frames[4]!.argv as string[])[3] = "cuda:other"; },
    (frames: Record<string, unknown>[]) => { frames[5]!.completedStages = ["00-trust", "02-capture"]; },
  ]) {
    const proofs = completedFixture(), frames = new TextDecoder().decode(proofs[`${completedRun}command.stdout`]!).trimEnd().split("\n").map(line => JSON.parse(line) as Record<string, unknown>);
    edit(frames); bindCompletedStream(proofs, "stdout", bytes(frames.map(frame => JSON.stringify(frame)).join("\n") + "\n"));
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SNAPSHOT_STREAMS_REQUIRED");
  }
});

test("completed child capture rejects unknown schemas, changed scopes, byte identities and qualification claims", () => {
  const edits: ((r: Record<string, unknown>) => void)[] = [
    r => { r.version = "other"; }, r => { r.status = "FAIL"; }, r => { r.requestSha256 = "0".repeat(64); }, r => { r.byteLength = 3; },
    r => { r.sha256 = sha256(bytes("abc")); }, r => { r.destination = "elsewhere"; }, r => { r.requiredOutsideDeadlineMs = 30001; },
    r => { r.fileSyncOnly = false; }, r => { r.outerBootstrapTrust = "SNAPSHOT_AUTHENTICATES_OUTER_BOOTSTRAP"; }, r => { r.unknown = false; },
  ];
  for (const key of ["directoryDurabilityEstablished", "atomicMountCustodyEstablished", "buildIsolationQualified", "custodyQualified", "llvmCodeExecuted",
    "cudaCompilationEstablished", "actualHostExecuted", "cudaGpuCodeExecuted", "trainingReady"]) edits.push(r => { r[key] = true; });
  for (const edit of edits) {
    const proofs = completedFixture(); editCompleted(proofs, snapshotPaths.capture, edit);
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SNAPSHOT_CAPTURE_REQUIRED");
  }
});

test("completed source observations retain exact FD/path identity and restrict the sole ancestor exception", () => {
  const edits: ((capture: Record<string, unknown>) => void)[] = [
    c => { (c.source as Record<string, unknown>).path = "/other/bun"; },
    c => { (c.source as Record<string, unknown>).unknown = true; },
    c => { const s = c.source as Record<string, unknown>; ((s.after as Record<string, unknown>).descriptor as Record<string, unknown>).inode = "999"; },
    c => { const s = c.source as Record<string, unknown>; (s.before as Record<string, unknown>).unknown = true; },
    c => { const s = c.source as Record<string, unknown>; (s.ancestorsBefore as unknown[]).reverse(); },
    c => { const s = c.source as Record<string, unknown>; ((s.ancestorsAfter as Record<string, unknown>[])[0]!.identity as Record<string, unknown>).mtime = "999"; },
  ];
  for (const [index, field, value] of [[3, "uid", 1002], [3, "gid", 1002], [3, "mode", 0o40775], [1, "uid", 1001], [0, "mode", 0o40777]] as const) {
    edits.push(c => { const source = c.source as Record<string, unknown>; for (const key of ["ancestorsBefore", "ancestorsAfter"]) {
      (((source[key] as Record<string, unknown>[])[index]!).identity as Record<string, unknown>)[field] = value;
    } });
  }
  for (const edit of edits) {
    const proofs = completedFixture(); editCompleted(proofs, snapshotPaths.capture, edit); expect(() => validateSnapshotReceipt(proofs)).toThrow();
  }
});

test("completed stat schemas reject numeric coercion, arrays, unsafe integers and noncanonical decimal device/inode/ns strings", () => {
  for (const field of ["bytes", "mode", "uid", "gid", "links"]) for (const value of ["1000", null, [], {}, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const proofs = completedFixture(); editCompleted(proofs, snapshotPaths.capture, capture => { (capture.stagedIdentity as Record<string, unknown>)[field] = value; });
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SNAPSHOT_STAT_REQUIRED");
  }
  for (const field of ["device", "inode", "mtime", "ctime"]) for (const value of [1, null, "", "01", "-1", "1e3", "1.0", "0x2", "1".repeat(33)]) {
    const proofs = completedFixture(); editCompleted(proofs, snapshotPaths.capture, capture => { (capture.finalIdentity as Record<string, unknown>)[field] = value; });
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SNAPSHOT_STAT_REQUIRED");
  }
  for (const field of ["stagedIdentity", "finalIdentity"]) {
    const proofs = completedFixture(); editCompleted(proofs, snapshotPaths.capture, capture => { capture[field] = []; }); expect(() => validateSnapshotReceipt(proofs)).toThrow();
    const extra = completedFixture(); editCompleted(extra, snapshotPaths.capture, capture => { (capture[field] as Record<string, unknown>).unknown = 1; });
    expect(() => validateSnapshotReceipt(extra)).toThrow("COMPLETED_SNAPSHOT_STAT_REQUIRED");
  }
});

test("completed private hardlink requires exact size, current UID, 0500, link transition and unchanged device/inode/gid/mtime", () => {
  for (const [field, value] of [["bytes", 3], ["uid", 0], ["mode", 0o100755], ["links", 2]] as const) {
    const proofs = completedFixture(); editCompleted(proofs, snapshotPaths.capture, capture => { (capture.stagedIdentity as Record<string, unknown>)[field] = value; });
    expect(() => validateSnapshotReceipt(proofs)).toThrow("SNAPSHOT_FILE_IDENTITY_REJECTED");
  }
  for (const [field, value] of [["device", "999"], ["inode", "999"], ["gid", 1001], ["mtime", "999"]] as const) {
    const proofs = completedFixture(); editCompleted(proofs, snapshotPaths.capture, capture => { (capture.finalIdentity as Record<string, unknown>)[field] = value; });
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SNAPSHOT_HARDLINK_REQUIRED");
  }
  const links = completedFixture(); editCompleted(links, snapshotPaths.capture, c => { (c.finalIdentity as Record<string, unknown>).links = 1; });
  expect(() => validateSnapshotReceipt(links)).toThrow("SNAPSHOT_FILE_IDENTITY_REJECTED");
  for (const ctime of ["9000000000000000000", (parse(rawCompletedProofs[snapshotPaths.capture]!).stagedIdentity as Record<string, unknown>).ctime]) {
    const proofs = completedFixture(); editCompleted(proofs, snapshotPaths.capture, c => { (c.finalIdentity as Record<string, unknown>).ctime = ctime; });
    expect(() => validateSnapshotReceipt(proofs)).not.toThrow();
  }
});

test("historical independent verification correlates exact receipts, packet, destination and private ancestor policy without fresh-file claims", () => {
  const edits: ((r: Record<string, unknown>) => void)[] = [
    r => { r.scope = "FRESH_RUNTIME_QUALIFIED"; }, r => { r.outsideReceipt = "other.json"; }, r => { r.outsideReceiptSha256 = "0".repeat(64); },
    r => { r.captureReceiptSha256 = "0".repeat(64); }, r => { r.approvedRequestSha256 = "0".repeat(64); },
    r => { r.sourceReview = snapshotPaths.binding; }, r => { r.sourceReviewSha256 = "0".repeat(64); }, r => { r.sourceSnapshot = "other.json"; },
    r => { r.sourceSnapshotCapturedBeforeInvocation = false; }, r => { r.sourceFileUnmodifiedByCapture = false; },
    r => { r.outerBootstrapTrustRetained = false; }, r => { r.unknown = true; },
    r => { (r.destination as Record<string, unknown>).inode = "999"; }, r => { (r.destination as Record<string, unknown>).mode = "0500"; },
    r => { (r.destination as Record<string, unknown>).links = 1; }, r => { (r.destination as Record<string, unknown>).unknown = true; },
  ];
  for (const key of ["privateSnapshotExecuted", "extractionPerformed", "llvmCodeExecuted", "buildIsolationQualified", "custodyQualified", "cudaCompilationEstablished", "trainingReady"]) edits.push(r => { r[key] = true; });
  for (const edit of edits) {
    const proofs = completedFixture(); editCompleted(proofs, `${completedRun}verification.json`, edit);
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_SNAPSHOT_VERIFICATION_REQUIRED");
  }
  for (const [index, key, value] of [[0, "uid", 1001], [0, "mode", 0o40755], [1, "mode", 0o40755], [2, "uid", 1001], [2, "mode", 0o40777],
    [0, "path", "/usr/local/bin"], [0, "uid", "1000"], [0, "mode", "0700"], [0, "unknown", true]] as const) {
    const proofs = completedFixture(); editCompleted(proofs, `${completedRun}verification.json`, r => { ((r.ancestors as Record<string, unknown>[])[index]!)[key] = value; });
    expect(() => validateSnapshotReceipt(proofs)).toThrow("COMPLETED_DESTINATION_ANCESTOR_POLICY_REQUIRED");
  }
});

test("postSnapshotRequest projects only the raw pinned approval into the literal consumed-capture phase", () => {
  const approved = rawCompletedProofs[`${completedRun}approved-request.json`]!, post = postSnapshotRequest(approved);
  expect(post).toEqual(expectedPostCapture()); expect(parse(approved)).toEqual(expectedRenewal());
  expect(post.authorityGranted).toBe(true); expect(post.renewedExecutorDecisionRequired).toBe(false);
  expect((post.authorization as Record<string, unknown>).grantStatus).toBe("APPROVED_SEQUENCE_IN_PROGRESS");
  expect((post.nativeBunSnapshotRenewal as Record<string, unknown>).completedDownloadsMayRepeat).toBe(false);
  expect((post.nativeBunSnapshotResult as Record<string, unknown>).privateSnapshotExecuted).toBe(false);
  for (const data of [json(expectedRenewal()), json(post), rawProofs[snapshotPaths.haltedRequest]!, bytes("{}"), new Uint8Array(1048577)]) {
    expect(() => postSnapshotRequest(data)).toThrow("PINNED_COMPLETED_SNAPSHOT_REQUEST_REQUIRED");
  }
  for (const edit of [(r: Record<string, unknown>) => { r.unknownGrant = true; }, (r: Record<string, unknown>) => { r.phase = "PROBE_ONLY"; },
    (r: Record<string, unknown>) => { r.authorityGranted = false; }, (r: Record<string, unknown>) => { r.gpuExecutionAuthorized = true; }]) {
    const request = parse(approved); edit(request); expect(() => postSnapshotRequest(json(request))).toThrow("PINNED_COMPLETED_SNAPSHOT_REQUEST_REQUIRED");
  }
});

test("post-capture completion never widens the original pending capture predicate or grants replay", async () => {
  const input = snapshotFixture(), requestBytes = json(expectedPostCapture());
  const advanced = { ...input, requestBytes, binding: { ...reviewOf(input), requestSha256: sha256(requestBytes) } };
  expect(() => validateSnapshotRenewal(advanced)).toThrow("EXACT_SNAPSHOT_RENEWAL_REQUIRED");
  const fake = fakeIO(advanced); await expect(runFake(fake)).rejects.toThrow("EXACT_SNAPSHOT_RENEWAL_REQUIRED"); expect(fake.events).toEqual(["inputs"]);
  expect(() => validateSnapshotReceipt(completedFixture())).not.toThrow();
});
