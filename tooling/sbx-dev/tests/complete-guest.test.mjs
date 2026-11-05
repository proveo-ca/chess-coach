// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { afterEach, beforeEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  chmodSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync,
  statSync, symlinkSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  accountCapacity, accountMetadataBytes, bunDestinations, commandPresenceScript, completeProfileSha256,
  parseComponentManifest, parseGuestArguments, parseToolPresence, reconcileComponentEntry,
  runGuestStage, validateArtifactLayout, validateVersion,
} from "../complete-guest.mjs";
import { artifactFileName, completeProfile } from "../complete-profile.mjs";
import { bunBootstrap, parseGuestReport } from "../complete-tools.mjs";
import { guestTools } from "../../native-ingress/f9-verify-sbx.mjs";
import { inspectZipArchive, TarInspector } from "../complete-archive.mjs";

const SCHEMA = "dev-sbx-complete-guest-v1";
const ATTEMPT = "0123456789abcdef";
const PRODUCTION_ROOT = `/home/agent/workspace/devtools-${ATTEMPT}`;
const HOST = "x86_64-unknown-linux-gnu";
const RUST_VERSION = `rustc 1.95.0 (synthetic 2026-01-01)\nbinary: rustc\nhost: ${HOST}\nrelease: 1.95.0\nLLVM version: 23.1.5\n`;
const RELEASES = { bun: "1.4.0\n", rustc: RUST_VERSION, cargo: "cargo 1.95.0 (synthetic 2026-01-01)\n",
  zig: "0.17.1\n", mise: "2026.11.2 linux-x64 (synthetic)\n", clang: "clang version 23.1.5 (synthetic)\nTarget: x86_64-unknown-linux-gnu\n" };
const IDS = ["bun", "rust", "zig", "mise", "llvm"];
const TARGETS = ["bun", "rust-dist", "zig", "mise", "llvm", "rust"];
let parent, root, sha256, calls, decodeCalls;

function result(stdout = "", extra = {}) {
  return { ok: true, outcome: "EXIT", code: 0, signal: null, stdout, stderr: "", ...extra };
}

function privateFile(path, value, mode = 0o400) {
  if (existsSync(path)) chmodSync(path, 0o600);
  writeFileSync(path, value, { mode });
  chmodSync(path, mode);
}

function summary() {
  const inputs = IDS.map((id) => {
    const artifact = completeProfile.artifacts.find((entry) => entry.id === id);
    return { id, sha256: artifact.sha256, bytes: artifact.bytes ?? 1,
      expandedBytes: 1, members: 1, notices: 1 };
  });
  return { inputs, archiveBytes: inputs.reduce((count, input) => count + input.bytes, 0),
    expandedBytes: 2 * 1024 ** 2 + 1024, members: 128, metadataBytes: 1024,
    controlReserveBytes: 2 * 1024 ** 2, controlReserveMembers: 64 };
}

function writeRecord(action, data, kind = "receipt", overrides = {}) {
  const record = { schema: SCHEMA, action, root, profileSha256: sha256,
    result: kind === "receipt" ? "PASS" : "INTENT", gate0: "OPEN", f9Qualified: false,
    trainingReady: false, data, ...overrides };
  privateFile(join(root, `${action}.${kind === "intent" ? "intent" : "receipt.json"}`), `${JSON.stringify(record)}\n`);
  return record;
}

function inspected(overrides = {}) {
  writeRecord("inspect", {}, "intent");
  writeRecord("inspect", summary(), "receipt", overrides);
}

function installed() {
  inspected();
  writeRecord("install", {}, "intent");
  const before = summary();
  writeRecord("install", { ...before, expandedBytes: before.expandedBytes + 10, members: before.members + 4,
    rustCopiedBytes: 10, rustCopiedMembers: 4 });
  for (const name of TARGETS) mkdirSync(join(root, name), { mode: 0o700 });
  for (const path of [`rust/lib/rustlib/${HOST}/lib`, "llvm/lib/clang/23/include", "zig/lib"]) {
    mkdirSync(join(root, path), { recursive: true, mode: 0o700 });
  }
  for (const path of ["bun/bin/bun", "rust/bin/rustc", "rust/bin/cargo", "zig/zig", "mise/bin/mise", "llvm/bin/clang"]) {
    const destination = join(root, path);
    mkdirSync(destination.slice(0, destination.lastIndexOf("/")), { recursive: true, mode: 0o700 });
    privateFile(destination, "SYNTHETIC_EXECUTABLE_NOT_RUN\n", 0o500);
  }
}

function seededInputs() {
  for (const name of ["complete-profile.mjs", "complete-archive.mjs", "complete-guest.mjs"]) {
    privateFile(join(root, "inputs", name), "SYNTHETIC_SOURCE_NOT_EXECUTED\n");
  }
  privateFile(join(root, "inputs/bun-bootstrap"), "SYNTHETIC_BOOTSTRAP_NOT_EXECUTED\n", 0o500);
  for (const artifact of completeProfile.artifacts) {
    privateFile(join(root, "inputs", artifactFileName(artifact)), "SYNTHETIC_UNPINNED_INPUT\n");
  }
}

function context(selectedRoot) {
  const path = `${selectedRoot}/rust/bin:${selectedRoot}/bun/bin:${selectedRoot}/zig:${selectedRoot}/llvm/bin:${selectedRoot}/mise/bin:/usr/local/bin:/usr/bin:/bin`;
  return { root: selectedRoot, path, env: { PATH: path, HOME: `${selectedRoot}/home`,
    XDG_CACHE_HOME: `${selectedRoot}/cache`, XDG_CONFIG_HOME: `${selectedRoot}/config`,
    MISE_DATA_DIR: `${selectedRoot}/state/mise`, MISE_CACHE_DIR: `${selectedRoot}/cache/mise`,
    MISE_CONFIG_DIR: `${selectedRoot}/config/mise`, MISE_AUTO_INSTALL: "false" } };
}

async function execute(argv, bounds) {
  calls.push({ argv: [...argv], bounds });
  expect(existsSync(join(root, "verify.intent"))).toBe(true);
  expect(statSync(join(root, "verify.intent")).mode & 0o7777).toBe(0o400);
  expect(bounds.milliseconds).toBe(10000);
  expect(bounds.cap).toBe(16384);
  if (argv[0] === "/bin/sh") {
    expect(argv.slice(0, 4)).toEqual(["/bin/sh", "-c", commandPresenceScript, "complete-dev-tools"]);
    return result(argv.slice(4).map((name) => `${name}\tPRESENT\n`).join(""));
  }
  const id = argv[0].split("/").at(-1);
  if (!Object.hasOwn(RELEASES, id)) throw new Error("SYNTHETIC_UNEXPECTED_COMMAND_SECRET");
  return result(RELEASES[id], { stderr: "SYNTHETIC_PRIVATE_STDERR\n" });
}

function stage(action, dependencies = {}, options = {}) {
  return runGuestStage(action, { root, profileSha256: sha256, ...options }, {
    validateRoot: (value) => { expect(value).toBe(root); }, context, execute,
    decode: async () => { decodeCalls++; throw new Error("SYNTHETIC_DECODE_MUST_NOT_RUN"); },
    ...dependencies,
  });
}

beforeEach(() => {
  parent = mkdtempSync("/tmp/opencode/complete-guest-");
  chmodSync(parent, 0o700);
  root = join(parent, `devtools-${ATTEMPT}`);
  mkdirSync(root, { mode: 0o700 });
  mkdirSync(join(root, "inputs"), { mode: 0o700 });
  sha256 = completeProfileSha256();
  privateFile(join(root, ".reservation"), `${completeProfile.id}\n${sha256}\n${ATTEMPT}\n`);
  calls = [];
  decodeCalls = 0;
});

afterEach(() => {
  rmSync(parent, { recursive: true, force: true });
});

test("CLI accepts only the three fixed actions and two unique flags", () => {
  for (const action of ["inspect", "install", "verify"]) {
    expect(parseGuestArguments([action, "--root", PRODUCTION_ROOT, "--profile-sha", sha256]))
      .toEqual({ action, options: { root: PRODUCTION_ROOT, profileSha256: sha256 } });
    expect(parseGuestArguments([action, "--profile-sha", sha256, "--root", PRODUCTION_ROOT]).action).toBe(action);
  }
});

test.each([
  [], ["retry"], ["--help"],
  ["inspect", "--root", PRODUCTION_ROOT, "--root", PRODUCTION_ROOT],
  ["inspect", "--profile-sha", "a".repeat(64), "--profile-sha", "a".repeat(64)],
  ["inspect", "--root", PRODUCTION_ROOT, "--execute", "anything"],
  ["inspect", "--root", PRODUCTION_ROOT, "--profile-sha", "A".repeat(64)],
  ["inspect", "--root", PRODUCTION_ROOT, "--profile-sha", "a".repeat(64), "extra"],
  ["inspect", "--root", "/home/agent/workspace/devrust-tools", "--profile-sha", "a".repeat(64)],
  ["inspect", "--root", `${PRODUCTION_ROOT}/../escape`, "--profile-sha", "a".repeat(64)],
  ["inspect", "--root", `${PRODUCTION_ROOT}\nPRIVATE`, "--profile-sha", "a".repeat(64)],
].map((argv) => [argv]))("CLI rejects malformed arguments %#", (argv) => {
  expect(() => parseGuestArguments(argv)).toThrow();
});

test("default root validation rejects synthetic paths without touching them", async () => {
  const report = await runGuestStage("inspect", { root, profileSha256: sha256 });
  expect(report.result).toBe("STOP");
  expect(report.error).toBe("INVALID_ROOT");
  expect(existsSync(join(root, "inspect.intent"))).toBe(false);
});

test("malformed stages never invoke execution or decode", async () => {
  expect((await stage("retry")).error).toBe("INVALID_ARGUMENTS");
  expect((await stage("inspect", {}, { extra: true })).error).toBe("INVALID_ARGUMENTS");
  expect((await stage("inspect", {}, { profileSha256: "b".repeat(64) })).error).toBe("INVALID_PROFILE");
  expect(calls).toHaveLength(0);
  expect(decodeCalls).toBe(0);
  expect(existsSync(join(root, "inspect.intent"))).toBe(false);
});

test("initial root leftovers stop inspection without overwrites", async () => {
  mkdirSync(join(root, "rust"), { mode: 0o700 });
  privateFile(join(root, "rust/owned"), "SYNTHETIC_KEEP\n");
  const report = await stage("inspect");
  expect(report.error).toBe("UNEXPECTED_LEFTOVERS");
  expect(readFileSync(join(root, "rust/owned"), "utf8")).toBe("SYNTHETIC_KEEP\n");
  expect(existsSync(join(root, "inspect.intent"))).toBe(false);
});

test("reservation content and readonly mode bind the profile and attempt", async () => {
  chmodSync(join(root, ".reservation"), 0o600);
  expect((await stage("inspect")).error).toBe("INVALID_PRIVATE_FILE");
  privateFile(join(root, ".reservation"), `${completeProfile.id}\n${"b".repeat(64)}\n${ATTEMPT}\n`);
  expect((await stage("inspect")).error).toBe("INVALID_RESERVATION");
  expect(existsSync(join(root, "inspect.intent"))).toBe(false);
});

test("unapproved synthetic raw archive sizes stop before decode and extraction", async () => {
  seededInputs();
  const report = await stage("inspect");
  expect(report.error).toBe("INPUT_INTEGRITY");
  expect(report.result).toBe("STOP");
  expect(decodeCalls).toBe(0);
  expect(calls).toHaveLength(0);
  expect(existsSync(join(root, "inspect.intent"))).toBe(true);
  expect(statSync(join(root, "inspect.intent")).mode & 0o7777).toBe(0o400);
  expect(existsSync(join(root, "inspect.receipt.json"))).toBe(false);
  expect((await stage("inspect")).error).toBe("STAGE_ALREADY_ATTEMPTED");
  expect(TARGETS.some((path) => existsSync(join(root, path)))).toBe(false);
});

test("hardlinked readonly input files are not private inputs", async () => {
  seededInputs();
  const path = join(root, "inputs", artifactFileName(completeProfile.artifacts.find((entry) => entry.id === "bun")));
  linkSync(path, join(parent, "synthetic-hardlink"));
  expect((await stage("inspect")).error).toBe("INVALID_PRIVATE_FILE");
  expect(decodeCalls).toBe(0);
});

test("input symlinks fail closed and preserve the external synthetic file", async () => {
  seededInputs();
  const path = join(root, "inputs/complete-profile.mjs");
  rmSync(path);
  privateFile(join(parent, "synthetic-source"), "SYNTHETIC_KEEP\n");
  symlinkSync(join(parent, "synthetic-source"), path);
  expect((await stage("inspect")).result).toBe("STOP");
  expect(readFileSync(join(parent, "synthetic-source"), "utf8")).toBe("SYNTHETIC_KEEP\n");
  expect(decodeCalls).toBe(0);
});

test("missing prior receipts stop later stages without creating an intent", async () => {
  expect((await stage("install")).error).toBe("INVALID_RECEIPT");
  expect((await stage("verify")).error).toBe("INVALID_RECEIPT");
  expect(existsSync(join(root, "install.intent"))).toBe(false);
  expect(existsSync(join(root, "verify.intent"))).toBe(false);
});

test("prior receipt root and profile bindings reject substitution", async () => {
  inspected({ root: `${root}-substituted` });
  expect((await stage("install")).error).toBe("INVALID_RECEIPT");
  writeRecord("inspect", summary(), "receipt", { profileSha256: "b".repeat(64) });
  expect((await stage("install")).error).toBe("INVALID_RECEIPT");
  expect(calls).toHaveLength(0);
});

test("install reinspection is terminal and never falls back to vendor installers", async () => {
  inspected();
  seededInputs();
  expect((await stage("install")).error).toBe("INPUT_INTEGRITY");
  expect(existsSync(join(root, "install.intent"))).toBe(true);
  expect(existsSync(join(root, "install.receipt.json"))).toBe(false);
  expect((await stage("install")).error).toBe("STAGE_ALREADY_ATTEMPTED");
  expect(calls).toHaveLength(0);
  expect(decodeCalls).toBe(0);
});

test("receipt counts reject expansion and assembly budget substitutions", async () => {
  installed();
  const receipt = JSON.parse(readFileSync(join(root, "install.receipt.json"), "utf8"));
  receipt.data.rustCopiedBytes++;
  writeRecord("install", receipt.data);
  expect((await stage("verify")).error).toBe("INVALID_RECEIPT");
  expect(existsSync(join(root, "verify.intent"))).toBe(false);
});

test("verification scopes environment, retains safe summaries, and never marks readiness", async () => {
  installed();
  const originalPath = process.env.PATH;
  const originalHome = process.env.HOME;
  const report = await stage("verify");
  expect(report.result).toBe("PASS");
  expect(report.gate0).toBe("OPEN");
  expect(report.f9Qualified).toBe(false);
  expect(report.trainingReady).toBe(false);
  expect(report.data.explanation).toBe("NOT_RUN");
  expect(report.data.licensing).toBe("NOT_QUALIFIED");
  expect(report.data.tools).toHaveLength(15);
  expect(report.data.checkedVersions).toEqual([
    { id: "bun", version: "1.4.0" }, { id: "rustc", version: "1.95.0" },
    { id: "cargo", version: "1.95.0" }, { id: "zig", version: "0.17.1" },
    { id: "mise", version: "2026.11.2" }, { id: "clang", version: "23.1.5" },
  ]);
  expect(calls).toHaveLength(7);
  expect(calls.slice(0, 6).map(({ argv }) => argv)).toEqual([
    [`${root}/bun/bin/bun`, "--version"], [`${root}/rust/bin/rustc`, "-vV"],
    [`${root}/rust/bin/cargo`, "--version"], [`${root}/zig/zig`, "version"],
    [`${root}/mise/bin/mise`, "--version"], [`${root}/llvm/bin/clang`, "--version"],
  ]);
  for (const call of calls) {
    expect(call.bounds.env.HOME).toBe(`${root}/home`);
    expect(call.bounds.env.MISE_AUTO_INSTALL).toBe("false");
    expect(call.bounds.env.PATH).toBe(context(root).path);
    expect(call.argv.some((arg) => /install\.sh|cargo (build|test)|rustup/.test(arg))).toBe(false);
  }
  expect(process.env.PATH).toBe(originalPath);
  expect(process.env.HOME).toBe(originalHome);
  expect(JSON.stringify(report)).not.toContain("SYNTHETIC_PRIVATE_STDERR");
  expect(JSON.stringify(report)).not.toContain("synthetic 2026-01-01");
  expect(statSync(join(root, "verify.receipt.json")).mode & 0o7777).toBe(0o400);
  expect((await stage("verify")).error).toBe("STAGE_ALREADY_ATTEMPTED");
});

test("missing static resources stop before any executable startup", async () => {
  installed();
  rmSync(join(root, "zig/lib"), { recursive: true });
  const report = await stage("verify");
  expect(report.error).toBe("MISSING_RESOURCE");
  expect(calls).toHaveLength(0);
  expect(existsSync(join(root, "verify.intent"))).toBe(true);
  expect(existsSync(join(root, "home"))).toBe(true);
  expect(existsSync(join(root, "verify.receipt.json"))).toBe(false);
});

test("resource symlinks cannot cause reads outside the owned tool root", async () => {
  installed();
  rmSync(join(root, "zig/lib"), { recursive: true });
  mkdirSync(join(parent, "synthetic-resource"), { mode: 0o700 });
  symlinkSync(join(parent, "synthetic-resource"), join(root, "zig/lib"));
  expect((await stage("verify")).error).toBe("MISSING_RESOURCE");
  expect(calls).toHaveLength(0);
});

test("native executable symlinks cannot select paths outside their package root", async () => {
  installed();
  rmSync(join(root, "bun/bin/bun"));
  privateFile(join(parent, "synthetic-executable"), "SYNTHETIC_EXTERNAL_NOT_RUN\n", 0o500);
  symlinkSync(join(parent, "synthetic-executable"), join(root, "bun/bin/bun"));
  expect((await stage("verify")).error).toBe("MISSING_RESOURCE");
  expect(calls).toHaveLength(0);
});

test("context paths outside the owned root stop without global environment mutation", async () => {
  installed();
  const report = await stage("verify", { context: (value) => ({ ...context(value),
    env: { ...context(value).env, HOME: parent } }) });
  expect(report.error).toBe("INVALID_CONTEXT");
  expect(calls).toHaveLength(0);
  expect(existsSync(join(root, "verify.intent"))).toBe(true);
});

test.each([
  { code: 9 }, { ok: false }, { outcome: "TIMEOUT" }, { signal: "SIGKILL" },
  { stdout: "SYNTHETIC_PRIVATE_STDOUT\n" }, { stdout: "1.4.0\n".repeat(3000) },
  { stderr: "SYNTHETIC_PRIVATE_STDERR".repeat(1000) },
])("version queries reject ignored status, malformed output, and output overflow %#", async (extra) => {
  installed();
  const report = await stage("verify", { execute: async () => result("1.4.0\n", extra) });
  expect(report.result).toBe("STOP");
  expect(["COMMAND_FAILED", "INVALID_VERSION"]).toContain(report.error);
  expect(JSON.stringify(report)).not.toContain("SYNTHETIC_PRIVATE");
  expect(existsSync(join(root, "verify.receipt.json"))).toBe(false);
  expect((await stage("verify")).error).toBe("STAGE_ALREADY_ATTEMPTED");
});

test("missing system tools never become readiness through seeded PATH entries", async () => {
  installed();
  const report = await stage("verify", { execute: async (argv, bounds) => {
    if (argv[0] !== "/bin/sh") return execute(argv, bounds);
    const names = argv.slice(4);
    return result(names.map((name, index) => `${name}\t${index === 0 ? "MISSING" : "PRESENT"}\n`).join(""));
  } });
  expect(report.error).toBe("MISSING_TOOLS");
  expect(report.gate0).toBe("OPEN");
  expect(report.f9Qualified).toBe(false);
  expect(report.trainingReady).toBe(false);
  expect(Object.hasOwn(report, "data")).toBe(false);
});

test("untrusted executor exceptions remain constant safe error codes", async () => {
  installed();
  const report = await stage("verify", { execute: async () => { throw new Error("SYNTHETIC_PRIVATE_EXCEPTION\n"); } });
  expect(report.error).toBe("COMMAND_FAILED");
  expect(JSON.stringify(report)).not.toContain("SYNTHETIC_PRIVATE");
});

test("strict version parsers independently pin all six native releases", () => {
  for (const [id, stdout] of Object.entries(RELEASES)) expect(validateVersion(id, stdout)).toBe(true);
});

test.each([
  ["bun", "1.4.0"], ["bun", "1.4.0\nPRIVATE\n"], ["bun", "1.4.01\n"],
  ["zig", "0.17.1-dev\n"], ["cargo", "cargo 1.95.01\n"], ["cargo", "cargo 1.95.0\nPRIVATE\n"],
  ["mise", "2026.11.20\n"], ["clang", "clang version 23.1.50\n"],
  ["clang", "Ubuntu clang version 23.1.5\n"], ["unknown", "1.4.0\n"],
  ["rustc", `${RUST_VERSION}release: 1.95.0\n`], ["rustc", `${RUST_VERSION}host: ${HOST}\n`],
  ["rustc", RUST_VERSION.replace(HOST, "aarch64-unknown-linux-gnu")],
  ["rustc", RUST_VERSION.replace("release: 1.95.0", "release: 1.95.0-nightly")],
  ["bun", "\x1b[32m1.4.0\n"], ["bun", "1.4.0\r\n"],
])("version parser rejects substitutions %#", (id, stdout) => {
  expect(() => validateVersion(id, stdout)).toThrow("INVALID_VERSION");
});

test("presence output requires exactly the known names and fields", () => {
  expect(parseToolPresence("bun\tPRESENT\ngit\tPRESENT\n", ["bun", "git"]))
    .toEqual([{ id: "bun", status: "PRESENT" }, { id: "git", status: "PRESENT" }]);
  for (const stdout of ["git\tPRESENT\nbun\tPRESENT\n", "bun\tPRESENT\ngit\tMISSING\n",
    "bun\tPRESENT\ngit\tPRESENT\nPRIVATE\n", "bun\t/usr/bin/bun\ngit\tPRESENT\n"]) {
    expect(() => parseToolPresence(stdout, ["bun", "git"])).toThrow("MISSING_TOOLS");
  }
});

test("capacity includes additional copies and refuses unsafe integer accounting", () => {
  const limits = completeProfile.limits;
  expect(accountCapacity({ bytes: 3, members: 2 }, { bytes: 7, members: 5 })).toEqual({ bytes: 10, members: 7 });
  expect(() => accountCapacity({ bytes: limits.expandedBytes - 1, members: 1 }, { bytes: 2, members: 0 })).toThrow("CAPACITY_EXCEEDED");
  expect(() => accountCapacity({ bytes: 1, members: limits.members }, { bytes: 0, members: 1 })).toThrow("CAPACITY_EXCEEDED");
  expect(() => accountCapacity({ bytes: -1, members: 0 }, { bytes: 0, members: 0 })).toThrow("CAPACITY_EXCEEDED");
  expect(() => accountCapacity({ bytes: 0, members: 0 }, { bytes: Number.MAX_SAFE_INTEGER + 1, members: 0 })).toThrow("CAPACITY_EXCEEDED");
});

test("one shared metadata budget debits the real parser counters across archives", () => {
  const reports = [0, 1].map((index) => {
    const inspector = new TarInspector({ root: "mise", maxBytes: 1024, maxMembers: 100, maxMetadataBytes: 65536 });
    inspector.write(syntheticTar("mise", { [`NOTICE-${index}`]: { body: "x" } }));
    return inspector.finish();
  });
  const cap = Math.max(...reports.map(({ metadataBytes }) => metadataBytes));
  expect(reports.every(({ metadataBytes }) => metadataBytes <= cap)).toBe(true);
  const used = accountMetadataBytes(0, reports[0].metadataBytes, cap);
  expect(() => accountMetadataBytes(used, reports[1].metadataBytes, cap)).toThrow("CAPACITY_EXCEEDED");
  for (const value of [undefined, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => accountMetadataBytes(0, value)).toThrow("CAPACITY_EXCEEDED");
  }
});

test("component manifests remain data-only and canonical", () => {
  expect(parseComponentManifest(Buffer.from(`file:bin/rustc\ndir:lib/rustlib/${HOST}/lib\n`)))
    .toEqual([{ type: "file", path: "bin/rustc" }, { type: "directory", path: `lib/rustlib/${HOST}/lib` }]);
});

test.each([
  "", "file:/etc/passwd\n", "file:../outside\n", "file:a/../b\n", "file:a//b\n",
  "file:a\\b\n", "file:a\nfile:a\n", "dir:a\nfile:a\n", "file:a\r\n",
  "exec:install.sh\n", "file:a\n\n", "file:a\0\n", "\uFEFFfile:a\n",
])("component manifest rejects unsupported fields and unsafe paths %#", (text) => {
  expect(() => parseComponentManifest(Buffer.from(text))).toThrow("INVALID_MANIFEST");
});

test("component manifests reject oversized metadata and malformed UTF-8", () => {
  expect(() => parseComponentManifest(Buffer.alloc(1024 * 1024 + 1))).toThrow("INVALID_MANIFEST");
  expect(() => parseComponentManifest(Buffer.from([0xff]))).toThrow("INVALID_MANIFEST");
});

test("Rust component reconciliation merges only directories or byte-identical files", () => {
  const directory = { type: "directory", mode: 0o700 };
  const first = { type: "file", size: 4, sha256: "a".repeat(64), mode: 0o751 };
  expect(reconcileComponentEntry(directory, { type: "directory", mode: 0o755 })).toBe(directory);
  expect(reconcileComponentEntry(first, { ...first, mode: 0o755 })).toBe(first);
  expect(reconcileComponentEntry(undefined, first)).toBe(first);
  expect(() => reconcileComponentEntry(first, { ...first, sha256: "b".repeat(64) })).toThrow("FILE_COLLISION");
  expect(() => reconcileComponentEntry(first, directory)).toThrow("FILE_COLLISION");
  expect(() => reconcileComponentEntry(directory, first)).toThrow("FILE_COLLISION");
  expect(() => reconcileComponentEntry(undefined, { type: "symlink" })).toThrow("INVALID_MANIFEST");
});

function entry(path, type = "file", extra = {}) {
  return { path, type, size: type === "file" ? 1 : 0, mode: type === "directory" ? 0o755 : 0o644,
    link: "", ...(type === "file" ? { content: Buffer.from("x") } : {}), ...extra };
}

function bunEntries() {
  return [entry("bun-linux-x64-baseline", "directory"),
    entry("bun-linux-x64-baseline/bun", "file", { mode: 0o755 }),
    entry("bun-linux-x64-baseline/LICENSE")];
}

test("Bun ZIP mapping preserves notices and relocates only the binary", () => {
  const entries = bunEntries();
  expect(bunDestinations(entries).map(({ path }) => path)).toEqual(["bun/bin/bun", "bun/LICENSE"]);
  expect(validateArtifactLayout({ id: "bun", root: "bun-linux-x64-baseline" },
    { entries, bytes: 2, members: 3 })).toEqual({ bytes: 2, members: 4, notices: 1 });
});

test("layout accounting includes every unique implicit directory before materialization", () => {
  const artifact = { id: "mise", root: "mise" };
  const entries = [entry("mise/bin/mise"), entry("mise/LICENSE"),
    entry("mise/share/nested/a/file"), entry("mise/share/nested/b/file")];
  const layout = validateArtifactLayout(artifact, { entries, bytes: 4, members: entries.length });
  expect(layout.members).toBe(10);
  const withExplicitParents = [...entries, entry("mise", "directory"), entry("mise/bin", "directory"),
    entry("mise/share", "directory"), entry("mise/share/nested", "directory"),
    entry("mise/share/nested/a", "directory"), entry("mise/share/nested/b", "directory")];
  expect(validateArtifactLayout(artifact, { entries: withExplicitParents, bytes: 4, members: withExplicitParents.length }).members).toBe(layout.members);
  expect(() => accountCapacity({ bytes: 0, members: completeProfile.limits.members - layout.members + 1 }, layout))
    .toThrow("CAPACITY_EXCEEDED");
});

test("small encoded inventories cannot grow implicit directories beyond the real member cap", () => {
  const entries = [entry("mise/bin/mise"), entry("mise/LICENSE"),
    ...Array.from({ length: 1000 }, (_, index) => entry(`mise/tree-${index}/${"d/".repeat(200)}file`))];
  expect(entries.length).toBeLessThan(completeProfile.limits.members);
  expect(() => validateArtifactLayout({ id: "mise", root: "mise" }, { entries, bytes: entries.length, members: entries.length }))
    .toThrow("CAPACITY_EXCEEDED");
});

test("Bun ZIP mapping rejects destination collisions, aliases, and unsafe paths", () => {
  for (const bad of [entry("bun-linux-x64-baseline/bin/bun"), entry("bun-linux-x64-baseline/bin"),
    entry("bun-linux-x64-baseline/../outside"), entry("outside/bun"), entry("bun-linux-x64-baseline/alias", "symlink")]) {
    expect(() => bunDestinations([...bunEntries(), bad])).toThrow();
  }
});

test("missing ZIP bodies, notices, and unknown layouts fail closed", () => {
  const artifact = { id: "bun", root: "bun-linux-x64-baseline" };
  expect(() => validateArtifactLayout(artifact, { entries: bunEntries().slice(0, 2), bytes: 1, members: 2 }))
    .toThrow("UNSUPPORTED_LAYOUT");
  const entries = bunEntries();
  entries[1] = { ...entries[1], content: undefined };
  expect(() => validateArtifactLayout(artifact, { entries, bytes: 2, members: 3 })).toThrow("ARCHIVE_REJECTED");
  expect(() => validateArtifactLayout({ id: "unknown", root: artifact.root },
    { entries: bunEntries(), bytes: 2, members: 3 })).toThrow("UNSUPPORTED_LAYOUT");
});

test("tar structural fixtures require expected resources and retained notices", () => {
  const fixtures = [
    { id: "rust", root: `rust-1.95.0-${HOST}`, files: ["rustc/bin/rustc", "cargo/bin/cargo",
      "rustfmt-preview/bin/rustfmt", "clippy-preview/bin/clippy-driver", "clippy-preview/bin/cargo-clippy",
      `rust-std-${HOST}/lib/rustlib/${HOST}/lib/libstd.rlib`,
      ...["rustc", "cargo", `rust-std-${HOST}`, "rustfmt-preview", "clippy-preview"].map((component) => `${component}/manifest.in`)] },
    { id: "zig", root: "zig-x86_64-linux-0.17.1", files: ["zig", "lib/std/std.zig"] },
    { id: "mise", root: "mise", files: ["bin/mise"] },
    { id: "llvm", root: "LLVM-23.1.5-Linux-X64", files: ["bin/clang", "lib/clang/23/include/stddef.h"] },
  ];
  for (const fixture of fixtures) {
    const entries = [...fixture.files, "LICENSE"].map((path) => entry(`${fixture.root}/${path}`));
    const inspection = { entries, bytes: entries.length, members: entries.length };
    expect(validateArtifactLayout(fixture, inspection).notices).toBe(1);
    expect(() => validateArtifactLayout(fixture, { ...inspection, entries: entries.slice(1) })).toThrow("UNSUPPORTED_LAYOUT");
  }
});

test("strip-components validation rejects links that escape only after stripping", () => {
  const artifact = { id: "mise", root: "mise" };
  const base = [entry("mise/bin/mise"), entry("mise/LICENSE")];
  for (const link of ["../../outside", "../mise/bin/mise", "/etc/passwd"]) {
    const entries = [...base, entry("mise/alias", "symlink", { link })];
    expect(() => validateArtifactLayout(artifact, { entries, bytes: 2, members: entries.length })).toThrow("UNSAFE_PATH");
  }
  const aliases = [...base, entry("mise/alias", "symlink", { link: "bin" }), entry("mise/alias/extra")];
  expect(() => validateArtifactLayout(artifact, { entries: aliases, bytes: 3, members: aliases.length })).toThrow("UNSAFE_PATH");
});

test("internal tar links remain structural and reject cycles or missing targets", () => {
  const artifact = { id: "mise", root: "mise" };
  const base = [entry("mise/bin/mise"), entry("mise/LICENSE")];
  const entries = [...base, entry("mise/alias", "symlink", { link: "bin/mise" }),
    entry("mise/copy", "hardlink", { link: "mise/bin/mise" })];
  expect(validateArtifactLayout(artifact, { entries, bytes: 2, members: entries.length }).notices).toBe(1);
  for (const additions of [
    [entry("mise/alias", "symlink", { link: "missing" })],
    [entry("mise/a", "symlink", { link: "b" }), entry("mise/b", "symlink", { link: "a" })],
    [entry("mise/copy", "hardlink", { link: "../other/file" })],
    [entry("mise/pipe", "fifo")], [entry("mise/special", "file", { mode: 0o4755 })],
  ]) {
    const invalid = [...base, ...additions];
    expect(() => validateArtifactLayout(artifact, { entries: invalid, bytes: 2, members: invalid.length })).toThrow();
  }
});

function syntheticTar(archiveRoot, files) {
  const directories = new Set([archiveRoot]);
  for (const path of Object.keys(files)) {
    const parts = `${archiveRoot}/${path}`.split("/");
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join("/"));
  }
  const records = [...directories].sort().map((path) => ({ path, type: "5", body: Buffer.alloc(0), mode: 0o755 }));
  for (const [path, value] of Object.entries(files)) {
    records.push({ path: `${archiveRoot}/${path}`, type: "0", body: Buffer.from(value.body), mode: value.mode ?? 0o644 });
  }
  const chunks = [];
  for (const record of records) {
    const header = Buffer.alloc(512);
    const slash = record.path.lastIndexOf("/");
    const name = record.path.length <= 100 ? record.path : record.path.slice(slash + 1);
    const prefix = record.path.length <= 100 ? "" : record.path.slice(0, slash);
    expect(Buffer.byteLength(name)).toBeLessThanOrEqual(100);
    expect(Buffer.byteLength(prefix)).toBeLessThanOrEqual(155);
    header.write(name, 0, "ascii");
    const octal = (value, offset, width) => header.write(`${value.toString(8).padStart(width - 1, "0")}\0`, offset, "ascii");
    octal(record.mode, 100, 8);
    octal(0, 108, 8);
    octal(0, 116, 8);
    octal(record.body.length, 124, 12);
    octal(0, 136, 12);
    header.fill(32, 148, 156);
    header.write(record.type, 156, "ascii");
    header.write("ustar\0", 257, "ascii");
    header.write("00", 263, "ascii");
    header.write(prefix, 345, "ascii");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
    chunks.push(header, record.body, Buffer.alloc((512 - record.body.length % 512) % 512));
  }
  return Buffer.concat([...chunks, Buffer.alloc(1024)]);
}

function syntheticZip(archiveRoot, binary = Buffer.concat([Buffer.from([127, 69, 76, 70]), Buffer.from("SYNTHETIC_BUN_NOT_EXECUTED\n")])) {
  const locals = [], central = [];
  let offset = 0;
  for (const [suffix, content, mode] of [["bun", binary, 0o755], ["LICENSE", "SYNTHETIC_NOTICE\n", 0o644]]) {
    const name = Buffer.from(`${archiveRoot}/${suffix}`);
    const bytes = Buffer.from(content);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x800, 6);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(0x314, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(bytes.length, 20);
    directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(((0o100000 | mode) << 16) >>> 0, 38);
    directory.writeUInt32LE(offset, 42);
    locals.push(local, name, bytes);
    central.push(directory, name);
    offset += local.length + name.length + bytes.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(2, 8);
  end.writeUInt16LE(2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

test("host bootstrap uses the real ZIP inspector's flat limits and content entries", async () => {
  const artifact = completeProfile.artifacts[0];
  const binary = Buffer.from([127, 69, 76, 70, 0, 1, 2, 3]);
  expect(await bunBootstrap(syntheticZip(artifact.root, binary))).toEqual(binary);
  await expect(bunBootstrap(syntheticZip(artifact.root, Buffer.from("NOT_AN_ELF")))).rejects.toThrow();
  await expect(bunBootstrap(syntheticZip("other-root", binary))).rejects.toThrow();
});

test("profile and host verifier require the same fifteen literal tool names", () => {
  expect(completeProfile.tools).toEqual(guestTools);
  expect(completeProfile.tools).toContain("ld.bfd");
});

async function syntheticWorkflow() {
  const file = (body, mode = 0o644) => ({ body, mode });
  const files = {
    rust: {
      "LICENSE-APACHE": file("SYNTHETIC_RUST_NOTICE\n"),
      "install.sh": file("SYNTHETIC_INSTALLER_MUST_NOT_RUN\n", 0o755),
      "rustc/manifest.in": file("file:bin/rustc\ndir:lib\n"),
      "rustc/bin/rustc": file("SYNTHETIC_RUSTC_NOT_EXECUTED\n", 0o755),
      "rustc/lib/librustc_driver.so": file("SYNTHETIC_DRIVER_NOT_LOADED\n"),
      "rustc/lib/shared.data": file("SYNTHETIC_IDENTICAL_COMPONENT_DATA\n"),
      "cargo/manifest.in": file("file:bin/cargo\nfile:lib/shared.data\n"),
      "cargo/bin/cargo": file("SYNTHETIC_CARGO_NOT_EXECUTED\n", 0o751),
      "cargo/lib/shared.data": file("SYNTHETIC_IDENTICAL_COMPONENT_DATA\n", 0o600),
      [`rust-std-${HOST}/manifest.in`]: file(`dir:lib/rustlib/${HOST}/lib\n`),
      [`rust-std-${HOST}/lib/rustlib/${HOST}/lib/libstd.rlib`]: file("SYNTHETIC_STDLIB_NOT_LOADED\n"),
      "rustfmt-preview/manifest.in": file("file:bin/rustfmt\n"),
      "rustfmt-preview/bin/rustfmt": file("SYNTHETIC_RUSTFMT_NOT_EXECUTED\n", 0o755),
      "clippy-preview/manifest.in": file("file:bin/clippy-driver\nfile:bin/cargo-clippy\n"),
      "clippy-preview/bin/clippy-driver": file("SYNTHETIC_CLIPPY_NOT_EXECUTED\n", 0o755),
      "clippy-preview/bin/cargo-clippy": file("SYNTHETIC_CARGO_CLIPPY_NOT_EXECUTED\n", 0o755),
    },
    zig: { LICENSE: file("SYNTHETIC_ZIG_NOTICE\n"), zig: file("SYNTHETIC_ZIG_NOT_EXECUTED\n", 0o755),
      "lib/std/std.zig": file("SYNTHETIC_ZIG_LIBRARY_NOT_LOADED\n") },
    mise: { LICENSE: file("SYNTHETIC_MISE_NOTICE\n"), "bin/mise": file("SYNTHETIC_MISE_NOT_EXECUTED\n", 0o755) },
    llvm: { LICENSE: file("SYNTHETIC_LLVM_NOTICE\n"), "bin/clang": file("SYNTHETIC_CLANG_NOT_EXECUTED\n", 0o755),
      "lib/clang/23/include/stddef.h": file("SYNTHETIC_CLANG_RESOURCE_NOT_LOADED\n") },
  };
  const raw = new Map(), tar = new Map();
  let expectedMetadataBytes = 0;
  const fixtureProfile = JSON.parse(JSON.stringify(completeProfile));
  for (const artifact of fixtureProfile.artifacts) {
    let bytes;
    if (artifact.id === "bun") {
      bytes = syntheticZip(artifact.root);
      expectedMetadataBytes += inspectZipArchive(bytes, { root: artifact.root, maxBytes: 65536,
        maxMembers: 100, maxMetadataBytes: 65536, maxEntryBytes: 65536 }).metadataBytes;
    }
    else {
      const decoded = syntheticTar(artifact.root, files[artifact.id]);
      const inspector = new TarInspector({ root: artifact.root, maxBytes: 65536, maxMembers: 100, maxMetadataBytes: 65536 });
      inspector.write(decoded);
      expectedMetadataBytes += inspector.finish().metadataBytes;
      tar.set(artifact.id, decoded);
      bytes = Buffer.concat([Buffer.from("SYNTHETIC_XZ_CONTAINER_NOT_EXECUTED\n"), decoded]);
    }
    artifact.sha256 = createHash("sha256").update(bytes).digest("hex");
    artifact.bytes = bytes.length;
    raw.set(artifact.id, bytes);
    privateFile(join(root, "inputs", artifactFileName(completeProfile.artifacts.find(({ id }) => id === artifact.id))), bytes);
  }
  const profileUrl = new URL("../complete-profile.mjs", import.meta.url).href;
  const archiveUrl = new URL("../complete-archive.mjs", import.meta.url).href;
  privateFile(join(root, "inputs/complete-profile.mjs"),
    `export { guestToolContext, validateGuestToolRoot, versionChecks } from ${JSON.stringify(profileUrl)};\n`
    + `const freeze = value => { if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value; };\n`
    + `export const completeProfile = freeze(${JSON.stringify(fixtureProfile)});\n`
    + `export function artifactFileName(artifact) { const expected = completeProfile.artifacts.find(({ id }) => id === artifact.id); if (!expected || JSON.stringify(artifact) !== JSON.stringify(expected)) throw new Error("SYNTHETIC_PROFILE_MISMATCH"); return artifact.id + "." + artifact.format; }\n`);
  privateFile(join(root, "inputs/complete-archive.mjs"), `export { inspectZipArchive, TarInspector } from ${JSON.stringify(archiveUrl)};\n`);
  privateFile(join(root, "inputs/complete-guest.mjs"), readFileSync(new URL("../complete-guest.mjs", import.meta.url)));
  privateFile(join(root, "inputs/bun-bootstrap"), "SYNTHETIC_BOOTSTRAP_NOT_EXECUTED\n", 0o500);
  const api = await import(pathToFileURL(join(root, "inputs/complete-guest.mjs")).href);
  const fixtureSha256 = api.completeProfileSha256();
  privateFile(join(root, ".reservation"), `${completeProfile.id}\n${fixtureSha256}\n${ATTEMPT}\n`);
  const decode = async (artifact, { onChunk }) => {
    decodeCalls++;
    const bytes = tar.get(artifact.id);
    for (let offset = 0; offset < bytes.length; offset += 137) onChunk(bytes.subarray(offset, offset + 137));
  };
  const extract = async (argv, bounds) => {
    if (argv[0] !== "/usr/bin/tar") return execute(argv, bounds);
    calls.push({ argv: [...argv], bounds });
    expect(existsSync(join(root, "install.intent"))).toBe(true);
    expect(bounds.milliseconds).toBe(1200000);
    expect(bounds.cap).toBe(16384);
    expect(argv).toEqual(["/usr/bin/tar", "--extract", "--xz", "--file", "/proc/self/fd/3", "--directory", "/proc/self/fd/4",
      "--strip-components=1", "--keep-old-files", "--no-overwrite-dir", "--no-same-owner", "--no-same-permissions",
      "--no-xattrs", "--no-acls", "--no-selinux"]);
    const input = readFileSync(`/proc/self/fd/${bounds.fd}`);
    const id = [...raw].find(([, bytes]) => bytes.equals(input))?.[0];
    expect(id).toBeDefined();
    for (const [path, value] of Object.entries(files[id])) {
      const destination = join(root, id === "rust" ? "rust-dist" : id, path);
      mkdirSync(destination.slice(0, destination.lastIndexOf("/")), { recursive: true, mode: 0o700 });
      privateFile(destination, value.body, value.mode);
    }
    return result("", { stderr: "SYNTHETIC_PRIVATE_TAR_STDERR\n" });
  };
  return { api, raw, tar, files, profile: fixtureProfile, decode, extract, expectedMetadataBytes,
    run: (action, dependencies = {}) => api.runGuestStage(action, { root, profileSha256: fixtureSha256 }, {
      validateRoot: () => true, context, decode, execute: extract, ...dependencies,
    }) };
}

test("synthetic pinned inputs exercise inspect, data-only install, and mocked verification", async () => {
  const fixture = await syntheticWorkflow();
  const inspected = await fixture.run("inspect");
  expect(inspected.result).toBe("PASS");
  expect(inspected.data.inputs).toHaveLength(5);
  expect(inspected.data.metadataBytes).toBe(fixture.expectedMetadataBytes);
  expect(decodeCalls).toBe(4);
  expect(calls).toHaveLength(0);
  expect(TARGETS.some((path) => existsSync(join(root, path)))).toBe(false);
  const installed = await fixture.run("install");
  expect(installed.result).toBe("PASS");
  expect(decodeCalls).toBe(8);
  expect(calls).toHaveLength(4);
  expect(installed.data.rustCopiedBytes).toBeGreaterThan(0);
  expect(installed.data.expandedBytes).toBe(inspected.data.expandedBytes + installed.data.rustCopiedBytes);
  expect(installed.data.members).toBe(inspected.data.members + installed.data.rustCopiedMembers);
  expect(readFileSync(join(root, "rust-dist/install.sh"), "utf8")).toBe("SYNTHETIC_INSTALLER_MUST_NOT_RUN\n");
  expect(readFileSync(join(root, "rust/lib/shared.data"), "utf8")).toBe("SYNTHETIC_IDENTICAL_COMPONENT_DATA\n");
  expect(statSync(join(root, "rust/lib/shared.data")).mode & 0o7777).toBe(0o644);
  expect(statSync(join(root, "rust/bin/cargo")).mode & 0o7777).toBe(0o751);
  expect(statSync(join(root, "bun/bin/bun")).mode & 0o7777).toBe(0o500);
  expect(readFileSync(join(root, "bun/LICENSE"), "utf8")).toBe("SYNTHETIC_NOTICE\n");
  const verified = await fixture.run("verify");
  expect(verified.result).toBe("PASS");
  expect(verified.f9Qualified).toBe(false);
  expect(verified.trainingReady).toBe(false);
  expect(verified.gate0).toBe("OPEN");
  expect(verified.data.tools).toHaveLength(15);
  expect(verified.data.tools.map(({ id }) => id)).toEqual(guestTools);
  expect(verified.data.allToolsAvailable).toBe(true);
  const hostState = { guestToolRoot: root, profileSha256: fixture.api.completeProfileSha256() };
  for (const [action, report] of [["inspect", inspected], ["install", installed], ["verify", verified]]) {
    expect(parseGuestReport(JSON.stringify(report), action, hostState)).toMatchObject({ action, root,
      profileSha256: hostState.profileSha256, result: "PASS", gate0: "OPEN", f9Qualified: false, trainingReady: false });
  }
  expect(parseGuestReport(JSON.stringify(verified), "verify", hostState).data).toEqual({ allToolsAvailable: true });
  expect(calls).toHaveLength(11);
  expect(JSON.stringify([inspected, installed, verified])).not.toContain("SYNTHETIC_PRIVATE");
});

test("the production context creates both Zig caches inside the synthetic root", async () => {
  installed();
  const template = "/home/agent/workspace/devtools-0000000000000000";
  const { guestToolContext } = await import("../complete-profile.mjs");
  const production = guestToolContext(template);
  const report = await stage("verify", { context: () => ({ root, path: production.path.replaceAll(template, root),
    env: Object.fromEntries(Object.entries(production.env).map(([key, value]) => [key, value.replaceAll(template, root)])) }) });
  expect(report.result).toBe("PASS");
  expect(statSync(join(root, "zig-cache")).mode & 0o7777).toBe(0o700);
  expect(statSync(join(root, "zig-local-cache")).mode & 0o7777).toBe(0o700);
});

test("same-sized synthetic raw input mutation stops before decode", async () => {
  const fixture = await syntheticWorkflow();
  const changed = Buffer.from(fixture.raw.get("bun"));
  changed[changed.length - 1] ^= 1;
  privateFile(join(root, "inputs/bun.zip"), changed);
  const report = await fixture.run("inspect");
  expect(report.error).toBe("INPUT_INTEGRITY");
  expect(decodeCalls).toBe(0);
  expect(calls).toHaveLength(0);
});

test("install validates every synthetic archive again before its first extraction", async () => {
  const fixture = await syntheticWorkflow();
  expect((await fixture.run("inspect")).result).toBe("PASS");
  const report = await fixture.run("install", { decode: async (artifact, options) => {
    if (artifact.id === "llvm") {
      options.onChunk(Buffer.from("SYNTHETIC_INVALID_TAR\n"));
      return;
    }
    return fixture.decode(artifact, options);
  } });
  expect(report.error).toBe("ARCHIVE_REJECTED");
  expect(calls).toHaveLength(0);
  expect(TARGETS.some((path) => existsSync(join(root, path)))).toBe(false);
  expect(existsSync(join(root, "install.intent"))).toBe(true);
  expect((await fixture.run("install")).error).toBe("STAGE_ALREADY_ATTEMPTED");
});

test("unsupported extracted Rust manifest stops without executing the vendor installer", async () => {
  const fixture = await syntheticWorkflow();
  expect((await fixture.run("inspect")).result).toBe("PASS");
  fixture.files.rust["cargo/manifest.in"].body = "exec:install.sh\n";
  const report = await fixture.run("install");
  expect(report.error).toBe("INVALID_MANIFEST");
  expect(calls).toHaveLength(4);
  expect(calls.every(({ argv }) => argv[0] === "/usr/bin/tar")).toBe(true);
  expect(existsSync(join(root, "rust"))).toBe(false);
  expect(readFileSync(join(root, "rust-dist/install.sh"), "utf8")).toBe("SYNTHETIC_INSTALLER_MUST_NOT_RUN\n");
  expect(existsSync(join(root, "install.receipt.json"))).toBe(false);
});

test("distinct component file bytes stop Rust reconciliation before sysroot writes", async () => {
  const fixture = await syntheticWorkflow();
  expect((await fixture.run("inspect")).result).toBe("PASS");
  fixture.files.rust["cargo/lib/shared.data"].body = "SYNTHETIC_DIFFERENT_COMPONENT_DATA\n";
  const report = await fixture.run("install");
  expect(report.error).toBe("FILE_COLLISION");
  expect(existsSync(join(root, "rust"))).toBe(false);
  expect(calls.every(({ argv }) => argv[0] === "/usr/bin/tar")).toBe(true);
  expect(existsSync(join(root, "install.intent"))).toBe(true);
});
