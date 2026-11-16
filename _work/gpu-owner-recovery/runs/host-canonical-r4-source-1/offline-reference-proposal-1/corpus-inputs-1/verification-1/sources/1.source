// SPEC: _spec/runtime-protocol.puml
import { describe, expect, test } from "bun:test";
import { QUALIFICATION, blobOid, gitArgv, LIMITS } from "../local-inputs-1/prepare";
import type { GitOptions, GitRunner, Store } from "../local-inputs-1/prepare";
import { DOCUMENT_PATHS, FLAGS, MISSING, PIN, REQUIRED, ROOT, SLICE, STATUS, aggregateUsage, check, context, encode, makePlan, prepare, runPhase, sha256 } from "./prepare";
import type { Documents, Plan } from "./prepare";

function documents(): Documents {
  const sourceManifest = encode({ reference: PIN, inputFileCount: 427, inputBytes: 3850400 });
  const materialization = encode({ status: "PARTIAL_PINNED_SOURCE_MATERIALIZED_PACKAGES_MISSING", reference: PIN, inputManifestSha256: sha256(sourceManifest), materializedFileCount: 427, materializedBytes: 3850400,
    sourceSha256: "a".repeat(64), installedPackageFilesCopied: 0, installedPackageStatus: "MISSING_IN_BOUNDED_LOCAL_SEARCH", missingPackages: MISSING, packageAbsenceEverywhereEstablished: false, ...QUALIFICATION });
  const value = JSON.parse(materialization.toString());
  return {
    addendum: encode({ status: "AUTHORIZED_TWO_FILE_CORPUS_EXTENSION_OF_EXISTING_LOCAL_INPUT_MATERIALIZATION", reference: PIN, gitRoot: ROOT,
      sealedSourceGenerationPreserved: DOCUMENT_PATHS.sourceManifest, freshSidecarRoot: SLICE + "/inputs/reference", entries: REQUIRED, additionalFiles: 2, additionalBytes: 671849,
      aggregateApplicationSourceAndCorpusFiles: 429, aggregateApplicationSourceAndCorpusBytes: 4522249,
      aggregateLimitsUnchanged: { files: 4096, inputBytes: 134217728, individualInputBytes: 16777216 }, exactManifestRequiredBeforeCopying: true, sidecarDoesNotEstablishOneAssembledRuntimeTree: true,
      referenceBundlingApproved: false, dependencyAcquisitionOrInstallationApproved: false, hostExecutionApproved: false, actualCommitOrPushApproved: false, experimentTrainingApproved: false, trainingReady: false }),
    discovery: encode({ status: "REQUIRED_CORPUS_INPUTS_REPORTED_PRESENT_IN_PINNED_LOCAL_GIT_TREE_NOT_MATERIALIZED_BY_THIS_RECORD", reference: PIN, gitRoot: ROOT, entries: REQUIRED, payloadReadOrCopiedByThisQuery: false, fullC14GuardExecuted: false, fullTreeAncestryAuthenticated: false }),
    sourceManifest, materialization, check: encode({ ...value, check: "PASS_EXACT_STAGED_MEMBERSHIP_BYTES_GIT_BLOB_SHA1_AND_SHA256", materializationSha256: sha256(materialization) }),
  };
}
function mutate(input: Documents, key: keyof Documents, change: (value: any) => void) { const value = JSON.parse(input[key].toString()); change(value); input[key] = encode(value); }
class MemoryStore implements Store {
  nodes = new Map<string, Buffer | "directory" | "symlink" | "other">(); events: string[] = [];
  kind(path: string) { const value = this.nodes.get(path); return value === undefined ? null : Buffer.isBuffer(value) ? "file" : value; }
  read(path: string, limit: number) { const bytes = this.nodes.get(path); if (!Buffer.isBuffer(bytes)) throw Error("REGULAR_FILE_REQUIRED"); if (bytes.length > limit) throw Error("READ_BOUND"); return Buffer.from(bytes); }
  create(path: string, bytes: Uint8Array) { if (this.nodes.has(path)) throw Error("EXCLUSIVE_CREATE"); const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : null; if (parent && this.kind(parent) !== "directory") throw Error("REGULAR_PARENT_REQUIRED"); this.events.push("create:" + path); this.nodes.set(path, Buffer.from(bytes)); }
  mkdir(path: string) { if (this.nodes.has(path)) throw Error("EXCLUSIVE_DIRECTORY"); this.events.push("mkdir:" + path); this.nodes.set(path, "directory"); }
  list(path: string) { const prefix = path + "/"; return [...new Set([...this.nodes.keys()].filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length).split("/")[0]!))]; }
}
function fixture() {
  const store = new MemoryStore(), payloads = [Buffer.from('{"synthetic":"corpus-contract"}\n'), Buffer.from('{"synthetic":"history-data"}\n')];
  const plan: Plan = makePlan(documents());
  plan.entries = REQUIRED.map((entry, index) => ({ ...entry, gitBlobOid: blobOid(payloads[index]!), bytes: payloads[index]!.length }));
  plan.usage = aggregateUsage(427, 3850400, plan.entries);
  const calls: { argv: string[]; options: GitOptions }[] = [];
  const git: GitRunner = (argv, options) => {
    calls.push({ argv, options }); store.events.push("git:blob");
    const index = plan.entries.findIndex(entry => JSON.stringify(argv) === JSON.stringify(gitArgv("blob", entry.gitBlobOid)));
    if (index < 0) throw Error("FORBIDDEN_GIT_ARGV");
    return { exitCode: 0, stdout: payloads[index]!, stderr: Buffer.alloc(0), signal: null };
  };
  return { store, plan, payloads, calls, git, ctx: () => context(store, () => plan, git) };
}
function staged() { const f = fixture(); prepare(f.ctx()); return f; }

describe("exact corpus scope and bound sealed-source totals", () => {
  test("binds immutable documents, pinned entries, and aggregate usage", () => {
    const input = documents(), plan = makePlan(input);
    expect(plan.entries).toEqual(REQUIRED); expect(plan.usage).toEqual({ sealedFiles: 427, sealedBytes: 3850400, sidecarFiles: 2, sidecarBytes: 671849, aggregateFiles: 429, aggregateBytes: 4522249 });
    expect(plan.documents.map(row => row.sha256)).toEqual((Object.keys(DOCUMENT_PATHS) as (keyof Documents)[]).map(key => sha256(input[key])));
  });
  test("rejects path, OID, mode, byte count, reference and membership substitutions", () => {
    for (const key of ["addendum", "discovery"] as const) {
      for (const [field, value] of [["path", "../escape.json"], ["gitBlobOid", "0".repeat(40)], ["mode", "120000"], ["bytes", 1]] as const) {
        const input = documents(); mutate(input, key, doc => { doc.entries[0][field] = value; }); expect(() => makePlan(input)).toThrow();
      }
      const input = documents(); mutate(input, key, doc => { doc.reference = "0".repeat(40); }); expect(() => makePlan(input)).toThrow("FIXED_REFERENCE_REQUIRED");
      const duplicate = documents(); mutate(duplicate, key, doc => { doc.entries[1] = doc.entries[0]; }); expect(() => makePlan(duplicate)).toThrow();
    }
  });
  test("keeps the original combined file cap rather than resetting it", () => expect(() => aggregateUsage(4095, 0, REQUIRED)).toThrow("AGGREGATE_FILE_BOUND"));
  test("keeps the original combined byte cap rather than resetting it", () => expect(() => aggregateUsage(427, LIMITS.inputBytes - 671848, REQUIRED)).toThrow("AGGREGATE_BYTE_BOUND"));
  test("enforces individual file cap and exact two safe regular paths", () => {
    expect(() => aggregateUsage(427, 3850400, REQUIRED, { ...LIMITS, individualInputBytes: 664539 })).toThrow("INDIVIDUAL_CORPUS_BOUND");
    expect(() => aggregateUsage(427, 3850400, REQUIRED.slice(0, 1))).toThrow("EXACT_TWO_CORPUS_INPUTS_REQUIRED");
    for (const entry of [{ ...REQUIRED[0]!, path: "../escape.json" }, { ...REQUIRED[0]!, mode: "100755" }, { ...REQUIRED[0]!, gitBlobOid: "--help" }]) expect(() => aggregateUsage(427, 3850400, [entry, REQUIRED[1]!])).toThrow();
    expect(() => aggregateUsage(427, 3850400, [REQUIRED[0]!, REQUIRED[0]!])).toThrow("DUPLICATE_CORPUS_PATH");
  });
  test("rejects changed aggregate limits or totals", () => {
    for (const change of [(doc: any) => { doc.aggregateLimitsUnchanged.files = 8192; }, (doc: any) => { doc.aggregateApplicationSourceAndCorpusBytes++; }]) {
      const input = documents(); mutate(input, "addendum", change); expect(() => makePlan(input)).toThrow();
    }
  });
  test("rejects altered sealed counts or manifest and materialization bindings", () => {
    for (const [key, change] of [
      ["sourceManifest", (doc: any) => { doc.inputFileCount = 428; }],
      ["materialization", (doc: any) => { doc.materializedBytes++; }],
      ["check", (doc: any) => { doc.inputManifestSha256 = "0".repeat(64); }],
      ["check", (doc: any) => { doc.materializationSha256 = "0".repeat(64); }],
    ] as const) { const input = documents(); mutate(input, key, change); expect(() => makePlan(input)).toThrow(); }
  });
  test("rejects widened approval or qualification claims and package-presence claims", () => {
    for (const [key, change] of [
      ["addendum", (doc: any) => { doc.referenceBundlingApproved = true; }],
      ["check", (doc: any) => { doc.fullC14GuardExecuted = true; }],
      ["check", (doc: any) => { doc.installedPackageFilesCopied = 1; }],
      ["check", (doc: any) => { doc.missingPackages = []; }],
    ] as const) { const input = documents(); mutate(input, key, change); expect(() => makePlan(input)).toThrow(); }
  });
  test("bounds metadata before parsing", () => { const input = documents(); input.addendum = Buffer.alloc(LIMITS.discoveryMetadataBytes + 1); expect(() => makePlan(input)).toThrow("DOCUMENT_BOUND"); });
});

describe("bounded exclusive corpus-only materialization", () => {
  test("persists exact manifest before the first payload read or copy", () => {
    const f = staged(), events = f.store.events;
    expect(events[0]).toBe("create:input-manifest.json"); expect(events.indexOf("create:input-manifest.json")).toBeLessThan(events.indexOf("git:blob"));
    expect(JSON.parse(f.store.read("input-manifest.json", 100000).toString()).entries.map((entry: any) => entry.path)).toEqual(REQUIRED.map(entry => entry.path));
    expect(f.calls.length).toBe(2);
  });
  test("uses only unchanged Git blob argv, no fetch, fixed cwd and bounded isolated environment", () => {
    const f = staged();
    for (const [index, { argv, options }] of f.calls.entries()) {
      expect(argv).toEqual(gitArgv("blob", f.plan.entries[index]!.gitBlobOid)); expect(options.cwd).toBe(ROOT);
      expect(options.environment.GIT_NO_LAZY_FETCH).toBe("1"); expect(options.environment.GIT_TERMINAL_PROMPT).toBe("0");
      expect(options.timeoutMs).toBeGreaterThan(0); expect(options.timeoutMs).toBeLessThanOrEqual(10000); expect(options.maxBuffer).toBe(LIMITS.individualInputBytes);
      expect(argv.some(value => ["fetch", "checkout", "switch", "clone", "fsck"].includes(value))).toBe(false);
    }
  });
  test("copies unchanged bytes only and retains missing packages and false qualifications", () => {
    const f = staged(), receipt = check(f.ctx());
    for (const [index, entry] of f.plan.entries.entries()) expect(f.store.read("inputs/reference/" + entry.path, 100000)).toEqual(f.payloads[index]!);
    expect(receipt.status).toBe(STATUS); expect(receipt.files.length).toBe(2); expect(receipt.usage.aggregateFiles).toBe(429);
    expect(receipt.missingPackages).toEqual(MISSING); for (const [key, value] of Object.entries(FLAGS)) expect((receipt as any)[key]).toBe(value);
  });
  test("refuses output reuse without overwriting the original manifest or payload", () => {
    const f = staged(), before = f.store.read("input-manifest.json", 100000); expect(() => prepare(f.ctx())).toThrow("EXCLUSIVE_PREPARATION_REQUIRED"); expect(f.store.read("input-manifest.json", 100000)).toEqual(before); expect(f.calls.length).toBe(2);
  });
  test("refuses invalid aggregate usage before any payload or manifest write", () => {
    const f = fixture(); f.plan.usage.aggregateFiles = 2; expect(() => prepare(f.ctx())).toThrow("AGGREGATE_USAGE_MISMATCH"); expect(f.calls.length).toBe(0); expect(f.store.events).toEqual([]);
  });
  test("preserves a failed partial copy and its exclusive failure receipt", () => {
    const f = fixture(); let calls = 0; const git: GitRunner = (argv, options) => ++calls === 2 ? { exitCode: 1, stdout: Buffer.alloc(0), stderr: Buffer.from("synthetic unavailable blob"), signal: null } : f.git(argv, options);
    expect(() => runPhase("prepare", context(f.store, () => f.plan, git))).toThrow("LOCAL_GIT_BLOB_READ_FAILED");
    expect(f.store.kind("inputs/reference/" + f.plan.entries[0]!.path)).toBe("file"); expect(f.store.kind("materialization.json")).toBeNull();
    const before = f.store.read("prepare-failure.json", 100000); expect(JSON.parse(before.toString()).copiedFiles).toBe(1);
    expect(() => runPhase("prepare", f.ctx())).toThrow("FAILED_SIDECAR_CANNOT_BE_REUSED"); expect(f.store.read("prepare-failure.json", 100000)).toEqual(before);
  });
  test("rejects wrong blob bytes or sizes before creating the affected file", () => {
    for (const bytes of [Buffer.from("bad"), Buffer.alloc(32)]) {
      const f = fixture(); const git: GitRunner = () => ({ exitCode: 0, stdout: bytes, stderr: Buffer.alloc(0), signal: null });
      expect(() => prepare(context(f.store, () => f.plan, git))).toThrow(); expect(f.store.kind("inputs/reference/" + f.plan.entries[0]!.path)).toBeNull();
    }
  });
  test("enforces the preparation trial deadline before reads or writes", () => {
    const f = fixture(); let time = 0; const ctx = context(f.store, () => f.plan, f.git, () => time); time = 180000; expect(() => prepare(ctx)).toThrow("CORPUS_TRIAL_DEADLINE_180S"); expect(f.store.events).toEqual([]);
  });
});

describe("exact sidecar verification", () => {
  test("rejects missing corpus inputs", () => { const f = staged(); f.store.nodes.delete("inputs/reference/" + f.plan.entries[0]!.path); expect(() => check(f.ctx())).toThrow("MISSING_STAGED_CORPUS"); });
  test("rejects extra files and directories", () => {
    for (const value of [Buffer.from("extra"), "directory"] as const) { const f = staged(); f.store.nodes.set("inputs/reference/extra", value); expect(() => check(f.ctx())).toThrow(Buffer.isBuffer(value) ? "EXTRA_STAGED_FILE" : "EXTRA_STAGED_DIRECTORY"); }
  });
  test("rejects symlinks and other nonregular inputs", () => {
    for (const kind of ["symlink", "other"] as const) { const f = staged(); f.store.nodes.set("inputs/reference/" + f.plan.entries[1]!.path, kind); expect(() => check(f.ctx())).toThrow("NONREGULAR_STAGED_CORPUS"); }
  });
  test("rejects same-length hash mismatch", () => { const f = staged(); f.store.nodes.set("inputs/reference/" + f.plan.entries[0]!.path, Buffer.alloc(f.payloads[0]!.length)); expect(() => check(f.ctx())).toThrow("CORPUS_GIT_BLOB_MISMATCH"); });
  test("rejects source-document binding or receipt SHA256 changes", () => {
    const f = staged(); f.plan.documents[0]!.sha256 = "0".repeat(64); expect(() => check(f.ctx())).toThrow("MANIFEST_BINDING_MISMATCH");
    const g = staged(), receipt = JSON.parse(g.store.read("materialization.json", 100000).toString()); receipt.files[0].sha256 = "0".repeat(64); g.store.nodes.set("materialization.json", encode(receipt)); expect(() => check(g.ctx())).toThrow("STAGED_SHA256_MISMATCH");
  });
  test("rechecks without overwriting successful prior receipts", () => {
    const f = staged(); check(f.ctx()); const before = f.store.read("check.json", 100000); check(f.ctx()); expect(f.store.read("check.json", 100000)).toEqual(before); expect(f.calls.length).toBe(2);
    f.store.nodes.set("inputs/reference/" + f.plan.entries[0]!.path, Buffer.alloc(f.payloads[0]!.length)); expect(() => check(f.ctx())).toThrow("CORPUS_GIT_BLOB_MISMATCH"); expect(f.store.read("check.json", 100000)).toEqual(before);
  });
});
