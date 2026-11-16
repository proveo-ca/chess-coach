// SPEC: _spec/runtime-protocol.puml
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWLIST, CLASSIFICATION, LIMITS, PARTIAL, PIN, ROOT, blobOid, check, context, discover, gitArgv, lockProvenance, materialize, runPhase, safeRelative, selectEntries, sourceSelected } from "./prepare";
import type { GitOptions, GitRunner, Store } from "./prepare";

const slice = dirname(fileURLToPath(import.meta.url));
class MemoryStore implements Store {
  nodes = new Map<string, Buffer | "directory" | "symlink" | "other">();
  events: string[] = [];
  constructor() {
    this.nodes.set("", "directory");
    for (const name of ["scope.json", "package-discovery.json"]) this.nodes.set(name, readFileSync(slice + "/" + name));
  }
  kind(path: string) { const value = this.nodes.get(path); return value === undefined ? null : Buffer.isBuffer(value) ? "file" : value; }
  read(path: string, limit: number) { const value = this.nodes.get(path); if (!Buffer.isBuffer(value)) throw Error("REGULAR_FILE_REQUIRED"); if (value.length > limit) throw Error("READ_BOUND"); return Buffer.from(value); }
  create(path: string, bytes: Uint8Array) {
    if (this.nodes.has(path)) throw Error("EXCLUSIVE_CREATE");
    if (this.kind(path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "") !== "directory") throw Error("REGULAR_PARENT_REQUIRED");
    this.events.push("create:" + path); this.nodes.set(path, Buffer.from(bytes));
  }
  mkdir(path: string) { if (this.nodes.has(path)) throw Error("EXCLUSIVE_DIRECTORY"); this.events.push("mkdir:" + path); this.nodes.set(path, "directory"); }
  list(path: string) { const prefix = path + "/"; return [...new Set([...this.nodes.keys()].filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length).split("/")[0]!))]; }
}

const payloads = new Map([
  ["package.json", Buffer.from('{"name":"synthetic-reference-data"}\n')],
  ["packages/example/src/source.ts", Buffer.from("synthetic non-executable source fixture\n")],
  ["pnpm-lock.yaml", Buffer.from("lockfileVersion: '9.0'\npackages:\n  fflate@0.8.3:\n    resolution: {integrity: sha512-AAAA==}\n  jssha@3.3.2:\n    resolution: {integrity: sha512-BBBB==}\nsnapshots:\n  fflate@0.8.3: {}\n")],
]);
function treeRow(path: string, bytes = Buffer.from("x"), mode = "100644", type = "blob", size = String(bytes.length)) {
  return `${mode} ${type} ${blobOid(bytes)} ${size.padStart(7)}\t${path}\0`;
}
const tree = Buffer.from([...payloads].map(([path, bytes]) => treeRow(path, bytes)).join(""));
function fixture() {
  const store = new MemoryStore(), calls: { argv: string[]; options: GitOptions }[] = [];
  const git: GitRunner = (argv, options) => {
    calls.push({ argv, options });
    let stdout: Buffer;
    if (JSON.stringify(argv) === JSON.stringify(gitArgv("type"))) stdout = Buffer.from("commit\n");
    else if (JSON.stringify(argv) === JSON.stringify(gitArgv("tree"))) stdout = tree;
    else {
      const bytes = [...payloads.values()].find(bytes => blobOid(bytes) === argv.at(-1));
      if (!bytes || JSON.stringify(argv) !== JSON.stringify(gitArgv("blob", blobOid(bytes)))) throw Error("FORBIDDEN_GIT_ARGV");
      stdout = bytes;
    }
    return { exitCode: 0, stdout, stderr: Buffer.alloc(0), signal: null };
  };
  return { store, git, calls, ctx: () => context(store, git) };
}
function staged() { const f = fixture(); discover(f.ctx()); materialize(f.ctx()); return f; }

describe("fixed source selection", () => {
  test("selects exactly the source allowlist shapes", () => {
    expect(ALLOWLIST.length).toBe(8);
    for (const path of ["packages/a/src/a.ts", "packages/a/src/deep/x.json", "packages/a/b/src/x.mts", "packages/a/package.json", "packages/a/config/tsconfig.test.json", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "nx.json", "tsconfig.tests.json"]) expect(sourceSelected(path)).toBe(true);
    for (const path of ["crates/a/src/lib.rs", "packages/a/assets/x.json", "packages/src/x.ts", "packages/a/src/x.wasm", "node_modules/a/package.json", "assets/bin", "README.md", "packages/a/tests/test.ts"]) expect(sourceSelected(path)).toBe(false);
  });
  test("preserves regular modes and exact membership", () => {
    const entries = selectEntries(Buffer.from(treeRow("package.json") + treeRow("packages/a/src/a.ts", undefined, "100755") + treeRow("crates/x.rs")));
    expect(entries.map(entry => [entry.path, entry.sourceMode, entry.origin, entry.reference])).toEqual([["package.json", "100644", "pinned-git", PIN], ["packages/a/src/a.ts", "100755", "pinned-git", PIN]]);
  });
  test("rejects unsupported selected symlink, gitlink and tree modes", () => {
    for (const [mode, type] of [["120000", "blob"], ["160000", "commit"], ["040000", "tree"]]) expect(() => selectEntries(Buffer.from(treeRow("packages/a/src/x.ts", undefined, mode, type)))).toThrow("UNSUPPORTED_SELECTED_MODE");
  });
  test("rejects path escape, absolute paths, controls and ambiguous components", () => {
    for (const path of ["../package.json", "/package.json", "packages/../package.json", "packages/./package.json", "packages//package.json", "packages\\a\\package.json", "C:/package.json", "package.json\n", ""]) expect(() => safeRelative(path)).toThrow();
    expect(() => safeRelative("a/".repeat(65) + "b")).toThrow();
    expect(() => safeRelative("a".repeat(4097))).toThrow();
  });
  test("rejects duplicate membership before copying", () => expect(() => selectEntries(Buffer.from(treeRow("package.json") + treeRow("package.json")))).toThrow("DUPLICATE_TREE_PATH"));
  test("enforces metadata cap and NUL framing", () => {
    expect(() => selectEntries(tree, { ...LIMITS, discoveryMetadataBytes: tree.length - 1 })).toThrow("DISCOVERY_METADATA_BOUND");
    expect(() => selectEntries(tree.subarray(0, -1))).toThrow("TREE_METADATA_TERMINATOR");
    expect(() => selectEntries(Buffer.from("not-a-record\0"))).toThrow("INVALID_TREE_RECORD");
  });
  test("rejects invalid UTF-8 and empty selection", () => {
    expect(() => selectEntries(Buffer.from([255, 0]))).toThrow();
    expect(() => selectEntries(Buffer.from(treeRow("crates/x.rs")))).toThrow("SOURCE_INPUTS_EMPTY");
  });
  test("enforces per-file cap", () => expect(() => selectEntries(tree, { ...LIMITS, individualInputBytes: 1 })).toThrow("INDIVIDUAL_INPUT_BOUND"));
  test("enforces total bytes cap", () => expect(() => selectEntries(tree, { ...LIMITS, inputBytes: 1 })).toThrow("TOTAL_INPUT_BOUND"));
  test("enforces file count cap", () => expect(() => selectEntries(tree, { ...LIMITS, inputFiles: 2 })).toThrow("INPUT_FILE_BOUND"));
});

describe("local Git-only discovery and exclusive staging", () => {
  test("uses only fixed read-only Git argv, environment, cwd, timeout and buffers", () => {
    const f = staged();
    expect(f.calls.length).toBe(5);
    for (const { argv, options } of f.calls) {
      expect(argv.slice(0, 7)).toEqual(["git", "--no-replace-objects", "--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null"]);
      expect(argv.some(arg => ["fetch", "checkout", "switch", "clone", "fsck", "filter"].includes(arg))).toBe(false);
      expect(options.cwd).toBe(ROOT); expect(options.environment.GIT_NO_LAZY_FETCH).toBe("1"); expect(options.environment.GIT_TERMINAL_PROMPT).toBe("0");
      expect(options.timeoutMs).toBeGreaterThan(0); expect(options.timeoutMs).toBeLessThanOrEqual(argv[8] === "blob" ? 10000 : 20000);
      expect(options.maxBuffer).toBe(argv[8] === "blob" ? LIMITS.individualInputBytes : LIMITS.discoveryMetadataBytes);
    }
    expect(() => gitArgv("blob", "--help")).toThrow(); expect(() => gitArgv("tree", PIN)).toThrow();
  });
  test("persists complete discovery and manifest before first payload copy", () => {
    const f = staged(), events = f.store.events;
    expect(events.indexOf("create:discovery.json")).toBeLessThan(events.indexOf("create:input-manifest.json"));
    expect(events.indexOf("create:input-manifest.json")).toBeLessThan(events.indexOf("create:materialization-start.json"));
    expect(events.indexOf("create:materialization-start.json")).toBeLessThan(events.indexOf("create:inputs/reference/package.json"));
    expect(JSON.parse(f.store.read("discovery.json", 100000).toString()).metadata.data).toBe(tree.toString("base64"));
  });
  test("cannot materialize without the persisted manifest", () => {
    const f = fixture(); discover(f.ctx()); f.store.nodes.delete("input-manifest.json");
    expect(() => materialize(f.ctx())).toThrow("REGULAR_METADATA_REQUIRED"); expect(f.store.kind("inputs")).toBeNull(); expect(f.calls.length).toBe(2);
  });
  test("rejects a modified manifest before any payload read", () => {
    const f = fixture(); discover(f.ctx()); const data = JSON.parse(f.store.read("input-manifest.json", 100000).toString()); data.entries[0].path = "../escape";
    f.store.nodes.set("input-manifest.json", Buffer.from(JSON.stringify(data)));
    expect(() => materialize(f.ctx())).toThrow("MANIFEST_BINDING_MISMATCH"); expect(f.calls.length).toBe(2); expect(f.store.kind("inputs")).toBeNull();
  });
  test("refuses changed scope bindings", () => {
    const f = fixture(); discover(f.ctx()); const data = JSON.parse(f.store.read("scope.json", 65536).toString()); data.extraObservation = "changed";
    f.store.nodes.set("scope.json", Buffer.from(JSON.stringify(data)));
    expect(() => materialize(f.ctx())).toThrow("MANIFEST_MEMBERSHIP_MISMATCH"); expect(f.store.kind("inputs")).toBeNull();
  });
  test("preserves exact source bytes as data and never claims offline completeness", () => {
    const f = staged(), result = check(f.ctx());
    for (const [path, bytes] of payloads) expect(f.store.read("inputs/reference/" + path, 100000)).toEqual(bytes);
    expect(result.status).toBe(PARTIAL); expect(result.sourceClassification).toBe(CLASSIFICATION); expect(result.materializedFileCount).toBe(3);
    expect(result.installedPackageFilesCopied).toBe(0); expect(result.installedPackageStatus).toBe("MISSING_IN_BOUNDED_LOCAL_SEARCH");
    for (const key of ["fullC14GuardExecuted", "fullTreeAncestryAuthenticated", "selectedBundleClosureEstablished", "completeOfflineInput", "referenceQualificationPassed", "nativeQualificationPassed", "referenceCodeExecuted", "trainingReady"] as const) expect(result[key]).toBe(false);
    expect(result.packageAbsenceEverywhereEstablished).toBe(false);
  });
  test("refuses reused discovery and staging while preserving repeated check outputs", () => {
    const f = staged(), original = f.store.read("input-manifest.json", 100000);
    expect(() => discover(f.ctx())).toThrow("EXCLUSIVE_DISCOVERY_REQUIRED"); expect(() => materialize(f.ctx())).toThrow("EXCLUSIVE_MATERIALIZATION_REQUIRED");
    check(f.ctx()); const checked = f.store.read("check.json", 100000); expect(check(f.ctx()).check).toBe("PASS_EXACT_STAGED_MEMBERSHIP_BYTES_GIT_BLOB_SHA1_AND_SHA256");
    expect(f.store.read("input-manifest.json", 100000)).toEqual(original); expect(f.store.read("check.json", 100000)).toEqual(checked);
  });
  test("records failed blob reads and preserves partial staged work", () => {
    const f = fixture(); discover(f.ctx()); let blobs = 0;
    const failing: GitRunner = (argv, options) => ++blobs === 2 ? { exitCode: 1, stdout: Buffer.alloc(0), stderr: Buffer.from("synthetic unavailable blob"), signal: null } : f.git(argv, options);
    expect(() => runPhase("materialize", context(f.store, failing))).toThrow("LOCAL_GIT_READ_FAILED");
    expect(f.store.kind("inputs/reference/package.json")).toBe("file"); expect(f.store.kind("materialization.json")).toBeNull();
    const failure = JSON.parse(f.store.read("materialize-failure.json", 100000).toString()); expect(failure.copiedFiles).toBe(1); expect(failure.gitCommands.length).toBe(2);
    expect(() => materialize(f.ctx())).toThrow("EXCLUSIVE_MATERIALIZATION_REQUIRED");
  });
  test("rejects source byte count or blob hash mismatch before creating a payload", () => {
    for (const bytes of [Buffer.from("bad"), Buffer.alloc(payloads.get("package.json")!.length)]) {
      const f = fixture(); discover(f.ctx());
      const bad: GitRunner = () => ({ exitCode: 0, stdout: bytes, stderr: Buffer.alloc(0), signal: null });
      expect(() => materialize(context(f.store, bad))).toThrow(); expect(f.store.kind("inputs/reference/package.json")).toBeNull();
    }
  });
  test("rejects oversized Git metadata and non-commit pins before creating a manifest", () => {
    for (const stdout of [Buffer.from("blob\n"), Buffer.alloc(LIMITS.discoveryMetadataBytes + 1)]) {
      const f = fixture(), bad: GitRunner = () => ({ exitCode: 0, stdout, stderr: Buffer.alloc(0), signal: null });
      expect(() => discover(context(f.store, bad))).toThrow(); expect(f.store.kind("input-manifest.json")).toBeNull();
    }
  });
  test("enforces the 180-second trial cap before Git or writes", () => {
    const f = fixture(); let time = 0; const ctx = context(f.store, f.git, () => time); time = 180000;
    expect(() => discover(ctx)).toThrow("PREPARATION_TRIAL_DEADLINE_180S"); expect(f.calls.length).toBe(0); expect(f.store.events).toEqual([]);
  });
  test("refuses failed preparation reuse and preserves the original failure receipt", () => {
    const f = fixture(), bad: GitRunner = () => ({ exitCode: 1, stdout: Buffer.alloc(0), stderr: Buffer.from("synthetic failure"), signal: null });
    expect(() => runPhase("discover", context(f.store, bad))).toThrow("LOCAL_GIT_READ_FAILED");
    const original = f.store.read("discover-failure.json", 100000);
    expect(() => runPhase("discover", f.ctx())).toThrow("FAILED_PREPARATION_CANNOT_BE_REUSED");
    expect(f.store.read("discover-failure.json", 100000)).toEqual(original); expect(f.calls.length).toBe(0); expect(f.store.kind("discovery.json")).toBeNull();
  });
});

describe("exact staged verification", () => {
  test("rejects missing files", () => { const f = staged(); f.store.nodes.delete("inputs/reference/package.json"); expect(() => check(f.ctx())).toThrow("MISSING_STAGED_INPUT"); expect(f.store.kind("check.json")).toBeNull(); });
  test("rejects extra files without reading them", () => { const f = staged(); f.store.nodes.set("inputs/reference/unexpected.ts", Buffer.from("data")); expect(() => check(f.ctx())).toThrow("EXTRA_STAGED_FILE"); });
  test("rejects extra directories", () => { const f = staged(); f.store.nodes.set("inputs/reference/extra", "directory"); expect(() => check(f.ctx())).toThrow("EXTRA_STAGED_DIRECTORY"); });
  test("rejects symlinks and nonregular inputs", () => {
    for (const kind of ["symlink", "other"] as const) { const f = staged(); f.store.nodes.set("inputs/reference/package.json", kind); expect(() => check(f.ctx())).toThrow("NONREGULAR_STAGED_INPUT"); }
  });
  test("rejects symlinked staged directories", () => { const f = staged(); f.store.nodes.set("inputs/reference/packages", "symlink"); expect(() => check(f.ctx())).toThrow("NONREGULAR_STAGED_INPUT"); });
  test("rejects same-length hash changes", () => { const f = staged(); f.store.nodes.set("inputs/reference/package.json", Buffer.alloc(payloads.get("package.json")!.length)); expect(() => check(f.ctx())).toThrow("GIT_BLOB_OID_MISMATCH"); });
  test("rechecks payloads even when a prior successful check receipt exists", () => {
    const f = staged(); check(f.ctx()); const original = f.store.read("check.json", 100000);
    f.store.nodes.set("inputs/reference/package.json", Buffer.alloc(payloads.get("package.json")!.length));
    expect(() => check(f.ctx())).toThrow("GIT_BLOB_OID_MISMATCH"); expect(f.store.read("check.json", 100000)).toEqual(original);
  });
  test("rejects receipt SHA256 changes", () => {
    const f = staged(), data = JSON.parse(f.store.read("materialization.json", 100000).toString()); data.files[0].sha256 = "0".repeat(64); f.store.nodes.set("materialization.json", Buffer.from(JSON.stringify(data)));
    expect(() => check(f.ctx())).toThrow("STAGED_SHA256_MISMATCH");
  });
  test("extracts exact lock integrities only as bounded copied-data provenance", () => {
    const f = staged(), result = check(f.ctx());
    expect(result.lockProvenance.map(row => [row.name, row.requiredVersion, row.status, row.matches[0]?.integrity])).toEqual([
      ["fflate", "0.8.3", "EXACT_VERSION_INTEGRITY_FOUND", "sha512-AAAA=="], ["jssha", "3.3.2", "EXACT_VERSION_INTEGRITY_FOUND", "sha512-BBBB=="],
    ]);
    expect(f.calls.length).toBe(5);
  });
  test("reports lock version mismatch without guessing an integrity", () => {
    const result = lockProvenance(Buffer.from("packages:\n  fflate@0.8.2:\n    resolution: {integrity: sha512-WRONG==}\n  jssha@3.3.2:\n    resolution: {}\n"));
    expect(result[0]!.status).toBe("REQUIRED_LOCK_VERSION_NOT_FOUND"); expect(result[0]!.matches).toEqual([]); expect(result[0]!.observedVersions).toEqual(["0.8.2"]);
    expect(result[1]!.status).toBe("EXACT_VERSION_INTEGRITY_UNRESOLVED"); expect(result[1]!.matches).toEqual([]);
  });
});
