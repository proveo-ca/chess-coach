// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync, copyFileSync, existsSync, linkSync, lstatSync, mkdirSync, mkdtempSync,
  readFileSync, renameSync, rmSync, statSync, symlinkSync, truncateSync, writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { checkBundle } from "../check-bundle.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const HOST = "x86_64-unknown-linux-gnu";
const VERSION = `rustc 1.95.0 (fixture 2026-04-14)\nbinary: rustc\ncommit-hash: fixture\nhost: ${HOST}\nrelease: 1.95.0\nLLVM version: 22.1.0\n`;
const PINS = `[settings]\nauto_install = false\n[tools]\n"core:bun" = "1.4.0"\n"core:rust" = { version = "1.95.0", profile = "minimal", components = ["rustfmt", "clippy"] }\n`;
let root, fixture, run, manifestPath, bundlePath, intentPath, bin, sysroot, originalPath, api, calls, approvals, override;

function result(stdout = "", extra = {}) {
  return { ok: true, code: 0, signal: null, outcome: "EXIT", stdout, stderr: "", ...extra };
}

async function execute(argv, bounds) {
  expect(existsSync(intentPath)).toBe(true);
  expect(statSync(intentPath).mode & 0o7777).toBe(0o600);
  expect(existsSync(bundlePath)).toBe(false);
  expect(existsSync(manifestPath)).toBe(false);
  calls.push({ argv: [...argv], bounds: { ...bounds } });
  if (override) return await override(argv, bounds);
  if (argv[1] === "install") return result("PRIVATE_MISE_LOG\n", { stderr: "PRIVATE_INSTALL_LOG\n" });
  if (argv.at(-1) === "-vV") return result(VERSION);
  if (argv.at(-1) === "sysroot") return result(`${sysroot}\n`);
  if (argv.at(-2) === "cargo") return result("cargo 1.95.0 (fixture 2026-04-14)\n");
  throw new Error("unexpected fixture command");
}

async function confirm(context) {
  approvals.push(context);
  return true;
}

function acquire(dependencies = {}, path = manifestPath) {
  return api.acquireTools(path, { execute, confirm, ...dependencies });
}

function manifest(change = {}) {
  return { schema: "dev-sbx-acquired-tools-v1", bunVersion: "1.4.0", rustVersion: "1.95.0", host: HOST,
    bundlePath, sha256: "a".repeat(64), ...change };
}

function writeManifest(value = manifest()) {
  if (!existsSync(bundlePath)) writeFileSync(bundlePath, "private fixture archive\n", { mode: 0o600 });
  writeFileSync(manifestPath, `${JSON.stringify(value)}\n`, { mode: 0o600 });
}

function tarMembers(path) {
  const bytes = readFileSync(path);
  const members = new Map();
  let offset = 0;
  while (offset < bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const string = (start, size) => header.subarray(start, start + size).toString("ascii").replace(/\0.*$/s, "");
    const prefix = string(345, 155);
    const name = `${prefix ? `${prefix}/` : ""}${string(0, 100)}`;
    const size = parseInt(string(124, 12), 8);
    members.set(name, { mode: parseInt(string(100, 8), 8), type: string(156, 1),
      content: bytes.subarray(offset + 512, offset + 512 + size).toString("utf8") });
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  expect(bytes.subarray(offset)).toHaveLength(1024);
  expect(bytes.subarray(offset).every((byte) => byte === 0)).toBe(true);
  return members;
}

beforeEach(async () => {
  root = mkdtempSync("/tmp/opencode/sbx-acquire-");
  chmodSync(root, 0o700);
  fixture = join(root, "repo");
  run = join(root, "run");
  bin = join(root, "path");
  sysroot = join(root, "selected-rust");
  for (const path of [fixture, run, bin, join(sysroot, "bin"), join(sysroot, "lib/rustlib/etc")]) mkdirSync(path, { recursive: true, mode: 0o700 });
  for (const path of ["tooling/sbx-dev/acquire-tools.mjs", "tooling/sbx-dev/check-bundle.mjs",
    "tooling/sbx-smoke/create-debug.mjs", "tooling/native-ingress/f9-diagnose.mjs", "tooling/native-ingress/f9-requirements.mjs"]) {
    const destination = join(fixture, path);
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    copyFileSync(join(REPO, path), destination);
  }
  writeFileSync(join(fixture, "mise.toml"), PINS);
  writeFileSync(join(fixture, "rust-toolchain.toml"), '[toolchain]\nchannel = "1.95.0"\n');
  writeFileSync(join(bin, "mise"), "#!/bin/sh\nexit 99\n", { mode: 0o700 });
  writeFileSync(join(sysroot, "bin/rustc"), "FIXTURE_RUSTC_NOT_EXECUTED\n", { mode: 0o755 });
  writeFileSync(join(sysroot, "bin/cargo"), "FIXTURE_CARGO_NOT_EXECUTED\n", { mode: 0o751 });
  writeFileSync(join(sysroot, "lib/librustc_driver.so"), "fixture runtime library\n", { mode: 0o644 });
  writeFileSync(join(sysroot, "lib/rustlib/etc/gdb_load_rust_pretty_printers.py"), "fixture third-party dependency\n", { mode: 0o644 });
  manifestPath = join(run, "tools.json");
  bundlePath = join(run, "rust-tools.tar");
  intentPath = `${bundlePath}.intent`;
  originalPath = process.env.PATH;
  process.env.PATH = bin;
  calls = [];
  approvals = [];
  override = null;
  api = await import(pathToFileURL(join(fixture, "tooling/sbx-dev/acquire-tools.mjs")).href);
});

afterEach(() => {
  process.env.PATH = originalPath;
  rmSync(root, { recursive: true, force: true });
});

test("core backend pins produce a private streamed bundle with automatic integrity validation", async () => {
  expect(api.toolPins()).toEqual({ bun: "1.4.0", rust: "1.95.0" });
  const acquired = await acquire();
  expect(acquired).toEqual(api.readAcquiredTools(manifestPath));
  expect(acquired).toEqual(manifest({ sha256: createHash("sha256").update(readFileSync(bundlePath)).digest("hex") }));
  expect(statSync(manifestPath).mode & 0o7777).toBe(0o600);
  expect(statSync(bundlePath).mode & 0o7777).toBe(0o600);
  expect(statSync(manifestPath).size).toBeLessThanOrEqual(8192);
  await checkBundle(bundlePath, acquired.sha256);
  const mise = join(bin, "mise");
  expect(calls).toEqual([
    { argv: [mise, "install", "--jobs", "1", "core:rust@1.95.0"], bounds: { milliseconds: 600000, cap: 65536 } },
    { argv: [mise, "exec", "core:rust@1.95.0", "--", "rustc", "-vV"], bounds: { milliseconds: 30000, cap: 16384 } },
    { argv: [mise, "exec", "core:rust@1.95.0", "--", "rustc", "--print", "sysroot"], bounds: { milliseconds: 30000, cap: 16384 } },
    { argv: [mise, "exec", "core:rust@1.95.0", "--", "cargo", "--version"], bounds: { milliseconds: 30000, cap: 16384 } },
  ]);
  expect(approvals).toHaveLength(1);
  expect(approvals[0].action).toBe("acquire");
  for (const scope of ["online host downloads", "cache/tool installation writes", "bin/rustc", "bin/cargo", "lib/", "120s", "not independent F9 provenance"]) {
    expect(approvals[0].prompt).toContain(scope);
  }
  const members = tarMembers(bundlePath);
  expect([...members.keys()].sort()).toEqual(["bin", "bin/cargo", "bin/rustc", "lib", "lib/librustc_driver.so", "lib/rustlib", "lib/rustlib/etc", "lib/rustlib/etc/gdb_load_rust_pretty_printers.py"]);
  expect(members.get("bin/rustc")).toMatchObject({ mode: 0o755, type: "0", content: "FIXTURE_RUSTC_NOT_EXECUTED\n" });
  expect(members.get("bin/cargo").mode).toBe(0o751);
  expect(members.get("lib/librustc_driver.so").mode).toBe(0o644);
});

test("selection excludes other bin files, host/repo content, and unrelated documentation", async () => {
  writeFileSync(join(sysroot, "bin/rustfmt"), "do not include");
  mkdirSync(join(sysroot, "share/doc/rust/html"), { recursive: true });
  writeFileSync(join(sysroot, "share/doc/rust/html/index.html"), "do not include");
  writeFileSync(join(sysroot, "share/doc/rust/README"), "do not include");
  writeFileSync(join(sysroot, "LICENSE-APACHE"), "Apache fixture notice\n");
  writeFileSync(join(sysroot, "share/doc/rust/LICENSE-MIT"), "MIT fixture notice\n");
  writeFileSync(join(sysroot, "COPYRIGHT"), "Copyright fixture notice\n");
  await acquire();
  const members = tarMembers(bundlePath);
  expect(members.get("LICENSE-APACHE").content).toBe("Apache fixture notice\n");
  expect(members.get("COPYRIGHT").content).toBe("Copyright fixture notice\n");
  expect(members.get("share/doc/rust/LICENSE-MIT").content).toBe("MIT fixture notice\n");
  for (const name of ["bin/rustfmt", "share/doc/rust/html", "share/doc/rust/html/index.html", "share/doc/rust/README", "mise.toml"]) expect(members.has(name)).toBe(false);
});

test("internal file/directory symlinks dereference to regular archive members only", async () => {
  renameSync(join(sysroot, "bin/rustc"), join(sysroot, "lib/real-rustc"));
  symlinkSync("../lib/real-rustc", join(sysroot, "bin/rustc"));
  symlinkSync("librustc_driver.so", join(sysroot, "lib/driver-alias.so"));
  symlinkSync("rustlib/etc", join(sysroot, "lib/etc-alias"));
  await acquire();
  const members = tarMembers(bundlePath);
  expect(members.get("bin/rustc").type).toBe("0");
  expect(members.get("lib/driver-alias.so")).toEqual(members.get("lib/librustc_driver.so"));
  expect(members.get("lib/etc-alias").type).toBe("5");
  expect(members.has("lib/etc-alias/gdb_load_rust_pretty_printers.py")).toBe(true);
  expect([...members.values()].every(({ type }) => ["0", "5"].includes(type))).toBe(true);
});

test("ustar prefix fields preserve a safe long relative layout", async () => {
  const directory = join(sysroot, "lib", "a".repeat(80), "b".repeat(65));
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${"c".repeat(80)}.rlib`), "long path fixture\n");
  await acquire();
  const name = `lib/${"a".repeat(80)}/${"b".repeat(65)}/${"c".repeat(80)}.rlib`;
  expect(tarMembers(bundlePath).get(name).content).toBe("long path fixture\n");
});

test.each([
  ["latest Bun", PINS.replace('"core:bun" = "1.4.0"', '"core:bun" = "latest"')],
  ["range Bun", PINS.replace('"1.4.0"', '"^1.4.0"')],
  ["prerelease Bun", PINS.replace('"1.4.0"', '"1.4.0-beta"')],
  ["leading zero Bun", PINS.replace('"1.4.0"', '"01.4.0"')],
  ["latest Rust", PINS.replace('version = "1.95.0"', 'version = "latest"')],
  ["wrong Rust", PINS.replace('version = "1.95.0"', 'version = "1.96.0"')],
  ["implicit backend", '[tools]\nbun = "1.4.0"\nrust = "1.95.0"\n'],
  ["missing pins", "[settings]\nauto_install = false\n"],
  ["numeric pin", PINS.replace('"core:bun" = "1.4.0"', '"core:bun" = 1.4')],
])("%s pins fail before approval/provider", async (_name, config) => {
  writeFileSync(join(fixture, "mise.toml"), config);
  expect(() => api.toolPins()).toThrow();
  await expect(acquire()).rejects.toThrow();
  expect(calls).toEqual([]);
  expect(approvals).toEqual([]);
  expect(existsSync(intentPath)).toBe(false);
});

test("toolchain mismatch and malformed configuration fail closed", async () => {
  writeFileSync(join(fixture, "rust-toolchain.toml"), '[toolchain]\nchannel = "stable"\n');
  expect(() => api.toolPins()).toThrow("matching Rust");
  writeFileSync(join(fixture, "mise.toml"), "[malformed");
  expect(() => api.toolPins()).toThrow();
});

test.each([["darwin", "x64"], ["linux", "arm64"], ["win32", "x64"]])("%s/%s refuses before pin/provider resolution", async (platform, arch) => {
  rmSync(join(fixture, "mise.toml"));
  await expect(acquire({ platform, arch })).rejects.toThrow("Linux x64");
  expect(calls).toEqual([]);
  expect(approvals).toEqual([]);
});

test("refused approval produces no install or artifacts", async () => {
  await expect(acquire({ confirm: async () => false })).rejects.toThrow("approval refused");
  expect(calls).toEqual([]);
  for (const path of [intentPath, bundlePath, manifestPath]) expect(existsSync(path)).toBe(false);
});

test("default confirmation refuses non-TTY even with fake execution", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
  Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
  try {
    await expect(api.acquireTools(manifestPath, { execute })).rejects.toThrow("approval refused");
    expect(calls).toEqual([]);
    expect(existsSync(intentPath)).toBe(false);
  } finally {
    if (descriptor) Object.defineProperty(process.stdin, "isTTY", descriptor);
    else delete process.stdin.isTTY;
  }
});

test("pin changes during approval refuse before intent/provider", async () => {
  await expect(acquire({ confirm: async () => {
    writeFileSync(join(fixture, "mise.toml"), PINS.replace('"1.4.0"', '"1.4.1"'));
    return true;
  } })).rejects.toThrow("pins changed");
  expect(calls).toEqual([]);
  expect(existsSync(intentPath)).toBe(false);
});

test("directory privacy changes during approval refuse before intent/provider", async () => {
  await expect(acquire({ confirm: async () => { chmodSync(run, 0o755); return true; } })).rejects.toThrow("not private");
  expect(calls).toEqual([]);
  expect(existsSync(intentPath)).toBe(false);
});

test("PATH resolution requires an existing absolute executable and follows its canonical target", async () => {
  const target = join(root, "canonical-mise");
  renameSync(join(bin, "mise"), target);
  symlinkSync(target, join(bin, "mise"));
  await acquire();
  expect(calls.every(({ argv }) => argv[0] === target)).toBe(true);
});

test.each(["missing", "relative", "nonexecutable"])("%s mise refuses without fallback", async (kind) => {
  if (kind === "missing") rmSync(join(bin, "mise"));
  if (kind === "relative") process.env.PATH = ".";
  if (kind === "nonexecutable") chmodSync(join(bin, "mise"), 0o600);
  await expect(acquire()).rejects.toThrow("mise executable");
  expect(calls).toEqual([]);
  expect(approvals).toEqual([]);
});

test.each(["intent", "bundle", "manifest"])("existing %s refuses without overwrite or approval", async (kind) => {
  const path = { intent: intentPath, bundle: bundlePath, manifest: manifestPath }[kind];
  writeFileSync(path, "retained\n", { mode: 0o600 });
  await expect(acquire()).rejects.toThrow("already exists");
  expect(readFileSync(path, "utf8")).toBe("retained\n");
  expect(calls).toEqual([]);
  expect(approvals).toEqual([]);
});

test("success refuses reuse even through a different manifest name", async () => {
  await acquire();
  const before = calls.length;
  const retained = readFileSync(bundlePath);
  await expect(acquire({}, join(run, "another.json"))).rejects.toThrow("already exists");
  expect(calls).toHaveLength(before);
  expect(readFileSync(bundlePath)).toEqual(retained);
});

test("concurrent approvals allow only one provider attempt per directory", async () => {
  let release;
  const ready = new Promise((resolveReady) => { release = resolveReady; });
  let waiting = 0;
  const agreement = async () => { if (++waiting === 2) release(); await ready; return true; };
  const outcomes = await Promise.allSettled([acquire({ confirm: agreement }), acquire({ confirm: agreement }, join(run, "another.json"))]);
  expect(outcomes.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
  expect(calls).toHaveLength(4);
});

test.each([
  ["exit", result("SECRET", { ok: false, code: 2 })],
  ["timeout", result("SECRET", { ok: false, outcome: "TIMEOUT", code: null })],
  ["interrupt", result("SECRET", { ok: false, outcome: "INTERRUPTED", signal: "SIGINT", code: null })],
  ["output cap", result("a".repeat(65537))],
  ["malformed", { ok: true }],
])("provider %s retains intent and refuses retries", async (_name, value) => {
  override = () => value;
  await expect(acquire()).rejects.toThrow("bounded acquisition");
  expect(calls).toHaveLength(1);
  expect(existsSync(intentPath)).toBe(true);
  expect(existsSync(manifestPath)).toBe(false);
  await expect(acquire()).rejects.toThrow("already exists");
  expect(calls).toHaveLength(1);
});

test.each([
  ["release", VERSION.replace("release: 1.95.0", "release: 1.94.0")],
  ["host", VERSION.replace(HOST, "aarch64-unknown-linux-gnu")],
  ["duplicate release", `${VERSION}release: 1.95.0\n`],
  ["duplicate host", `${VERSION}host: ${HOST}\n`],
  ["header", VERSION.replace("rustc 1.95.0", "rustc 1.95.1")],
])("Rust %s mismatch stops before sysroot/Cargo", async (_name, stdout) => {
  override = (argv) => result(argv[1] === "install" ? "" : stdout);
  await expect(acquire()).rejects.toThrow("release or host");
  expect(calls).toHaveLength(2);
  expect(existsSync(manifestPath)).toBe(false);
});

test.each(["cargo 1.94.0 (fixture)\n", "cargo 1.95.0-nightly\n", "cargo 1.95.00\n", "cargo 1.95.0\ncargo 1.95.0\n"])("Cargo output %j refuses", async (stdout) => {
  override = (argv) => result(argv[1] === "install" ? "" : argv.at(-1) === "-vV" ? VERSION : argv.at(-1) === "sysroot" ? `${sysroot}\n` : stdout);
  await expect(acquire()).rejects.toThrow("Cargo release");
  expect(calls).toHaveLength(4);
  expect(existsSync(bundlePath)).toBe(false);
});

test.each(["relative", "dot", "traversal", "multiline", "extra-newline", "symlink", "file"])("%s sysroot refuses before packaging", async (kind) => {
  const alias = join(root, "alias-sysroot");
  symlinkSync(sysroot, alias);
  const selected = { relative: "relative", dot: `${sysroot}/.`, traversal: `${sysroot}/../selected-rust`, multiline: `${sysroot}\nSECRET`,
    "extra-newline": `${sysroot}\n`, symlink: alias, file: join(sysroot, "bin/rustc") }[kind];
  override = (argv) => result(argv[1] === "install" ? "" : argv.at(-1) === "-vV" ? VERSION : `${selected}\n`);
  await expect(acquire()).rejects.toThrow();
  expect(calls).toHaveLength(3);
  expect(existsSync(bundlePath)).toBe(false);
  expect(existsSync(intentPath)).toBe(true);
});

test.each(["external file", "external directory", "parent traversal", "symlink cycle", "directory cycle"])("%s rejects and retains partial private output", async (kind) => {
  const outside = join(root, "outside");
  mkdirSync(outside);
  writeFileSync(join(outside, "secret"), "OUTSIDE_SECRET\n");
  const link = join(sysroot, "lib/link");
  if (kind === "external file") symlinkSync(join(outside, "secret"), link);
  if (kind === "external directory") symlinkSync(outside, link);
  if (kind === "parent traversal") symlinkSync("../../outside/secret", link);
  if (kind === "symlink cycle") { symlinkSync("link2", link); symlinkSync("link", join(sysroot, "lib/link2")); }
  if (kind === "directory cycle") symlinkSync(".", link);
  await expect(acquire()).rejects.toThrow();
  expect(existsSync(intentPath)).toBe(true);
  expect(existsSync(manifestPath)).toBe(false);
  expect(statSync(bundlePath).mode & 0o7777).toBe(0o600);
  expect(readFileSync(bundlePath).includes(Buffer.from("OUTSIDE_SECRET"))).toBe(false);
  await expect(acquire()).rejects.toThrow("already exists");
});

test("special files reject without blocking", async () => {
  const creation = spawnSync("/usr/bin/mkfifo", [join(sysroot, "lib/fifo")]);
  expect(creation.status).toBe(0);
  await expect(acquire()).rejects.toThrow("special file");
  expect(existsSync(manifestPath)).toBe(false);
});

test("packaging deadline retains intent and partial archive without a manifest", async () => {
  let clock = 0;
  const time = spyOn(performance, "now").mockImplementation(() => { clock += 40000; return clock; });
  try {
    await expect(acquire()).rejects.toThrow("packaging deadline");
    expect(existsSync(intentPath)).toBe(true);
    expect(existsSync(bundlePath)).toBe(true);
    expect(existsSync(manifestPath)).toBe(false);
  } finally { time.mockRestore(); }
});

test("existing validator failure cannot publish a manifest or trigger provider retry", async () => {
  writeFileSync(join(fixture, "tooling/sbx-dev/check-bundle.mjs"), 'console.error("PRIVATE_VALIDATOR_LOG"); process.exitCode = 2;\n');
  await expect(acquire()).rejects.toThrow("bounded acquisition command failed");
  expect(calls).toHaveLength(4);
  expect(existsSync(bundlePath)).toBe(true);
  expect(existsSync(intentPath)).toBe(true);
  expect(existsSync(manifestPath)).toBe(false);
  await expect(acquire()).rejects.toThrow("already exists");
  expect(calls).toHaveLength(4);
});

test.each(["space name", "newline\nname", "back\\slash", "unicode-λ", "-".repeat(101)])("unsafe or unrepresentable member %j refuses", async (name) => {
  writeFileSync(join(sysroot, "lib", name), "unsafe fixture\n");
  await expect(acquire()).rejects.toThrow();
  expect(existsSync(manifestPath)).toBe(false);
});

test("member paths over 256 characters refuse", async () => {
  const nested = join(sysroot, "lib", "a".repeat(80), "b".repeat(65), "c".repeat(90));
  mkdirSync(nested, { recursive: true });
  writeFileSync(join(nested, "d".repeat(40)), "too long\n");
  await expect(acquire()).rejects.toThrow("unsafe bundle member");
});

test.each([[2 * 1024 ** 3, "2 GiB"], [4 * 1024 ** 3 + 1, "4 GiB"]])("sparse file size %s trips %s cap before content reads", async (size, label) => {
  const file = join(sysroot, "lib/large.rlib");
  writeFileSync(file, "");
  truncateSync(file, size);
  await expect(acquire()).rejects.toThrow(label);
  expect(statSync(bundlePath).size).toBeLessThan(65536);
  expect(existsSync(manifestPath)).toBe(false);
});

test("member count caps traversal at 20000", async () => {
  const library = join(sysroot, "lib/many");
  mkdirSync(library);
  for (let index = 0; index < 20000; index++) writeFileSync(join(library, `member-${index}`), "");
  await expect(acquire()).rejects.toThrow("20000 member cap");
  expect(statSync(bundlePath).size).toBeLessThan(11 * 1024 ** 2);
  expect(existsSync(manifestPath)).toBe(false);
}, 30000);

test.each(["bin/rustc", "bin/cargo"])("missing or nonexecutable %s refuses", async (name) => {
  chmodSync(join(sysroot, name), 0o644);
  await expect(acquire()).rejects.toThrow("executable regular");
  expect(existsSync(manifestPath)).toBe(false);
});

test("optional notices cannot broaden traversal through symlinks or directories", async () => {
  mkdirSync(join(sysroot, "LICENSE-MIT"));
  await expect(acquire()).rejects.toThrow("notice must be a regular file");
  expect(existsSync(manifestPath)).toBe(false);
});

test.each([0o644, 0o400, 0o660, 0o1600])("manifest mode %s refuses", (mode) => {
  writeManifest();
  chmodSync(manifestPath, mode);
  expect(() => api.readAcquiredTools(manifestPath)).toThrow("private file");
});

test.each(["schema", "bunVersion", "rustVersion", "host", "bundlePath", "sha256", "extra", "array", "missing", "null"])("manifest %s mismatch refuses", (field) => {
  let value = manifest();
  if (field === "extra") value.extra = "raw secret";
  else if (field === "array") value = [value];
  else if (field === "missing") delete value.host;
  else if (field === "null") value = null;
  else value[field] = field === "sha256" ? "A".repeat(64) : "mismatch";
  writeManifest(value);
  expect(() => api.readAcquiredTools(manifestPath)).toThrow("invalid acquired tools manifest");
});

test.each(["bunVersion", "rustVersion", "host", "bundlePath", "sha256"])("manifest %s never coerces arrays", (field) => {
  const value = manifest();
  value[field] = [value[field]];
  writeManifest(value);
  expect(() => api.readAcquiredTools(manifestPath)).toThrow();
});

test("manifest cannot select an alternate/traversal bundle or outdated root pins", () => {
  for (const path of [join(root, "outside.tar"), `${run}/./rust-tools.tar`, `${run}/../run/rust-tools.tar`]) {
    writeManifest(manifest({ bundlePath: path }));
    expect(() => api.readAcquiredTools(manifestPath)).toThrow();
  }
  writeManifest();
  writeFileSync(join(fixture, "mise.toml"), PINS.replace('"1.4.0"', '"1.4.1"'));
  expect(() => api.readAcquiredTools(manifestPath)).toThrow();
});

test.each(["symlink", "hardlink", "directory", "oversized", "malformed"])("manifest %s refuses", (kind) => {
  writeManifest();
  if (kind === "oversized") writeFileSync(manifestPath, " ".repeat(8193));
  else if (kind === "malformed") writeFileSync(manifestPath, "{bad-json");
  else {
    const retained = join(run, "retained.json");
    renameSync(manifestPath, retained);
    if (kind === "symlink") symlinkSync(retained, manifestPath);
    if (kind === "hardlink") linkSync(retained, manifestPath);
    if (kind === "directory") mkdirSync(manifestPath, { mode: 0o600 });
  }
  expect(() => api.readAcquiredTools(manifestPath)).toThrow();
});

test.each(["symlink", "hardlink", "directory", "public", "oversized"])("bundle %s refuses on manifest read", (kind) => {
  writeManifest();
  if (kind === "public") chmodSync(bundlePath, 0o644);
  else if (kind === "oversized") truncateSync(bundlePath, 2 * 1024 ** 3 + 1);
  else {
    const retained = join(run, "retained.tar");
    renameSync(bundlePath, retained);
    if (kind === "symlink") symlinkSync(retained, bundlePath);
    if (kind === "hardlink") linkSync(retained, bundlePath);
    if (kind === "directory") mkdirSync(bundlePath, { mode: 0o600 });
  }
  expect(() => api.readAcquiredTools(manifestPath)).toThrow();
});

test("all APIs require canonical private nonsymlink manifest parents", async () => {
  writeManifest();
  for (const path of ["tools.json", `${run}/./tools.json`, `${run}/../run/tools.json`, bundlePath, intentPath]) {
    expect(() => api.readAcquiredTools(path)).toThrow();
    await expect(acquire({}, path)).rejects.toThrow();
  }
  chmodSync(run, 0o755);
  expect(() => api.readAcquiredTools(manifestPath)).toThrow("private and user-owned");
  await expect(acquire()).rejects.toThrow("private and user-owned");
  chmodSync(run, 0o700);
  const alias = join(root, "run-alias");
  symlinkSync(run, alias);
  expect(() => api.readAcquiredTools(join(alias, "tools.json"))).toThrow();
  await expect(acquire({}, join(alias, "tools.json"))).rejects.toThrow();
  expect(calls).toEqual([]);
});

test("all ASCII controls reject before approval/filesystem/provider", async () => {
  for (const code of [...Array(32).keys(), 127]) {
    const path = `${manifestPath}${String.fromCharCode(code)}`;
    expect(() => api.readAcquiredTools(path)).toThrow("canonical absolute");
    await expect(acquire({}, path)).rejects.toThrow("canonical absolute");
  }
  expect(calls).toEqual([]);
  expect(approvals).toEqual([]);
});

test.each([
  [], ["--yes"], ["--manifest"], ["--manifest", "relative"], ["--manifest", "/tmp/a", "--yes"],
  ["--manifest", "/tmp/a", "--manifest", "/tmp/b"], ["--manifest=/tmp/a", "--manifest=/tmp/a"], ["--execute", "fake"],
].map((argv) => [argv]))("CLI refuses invalid/duplicate/bypass arguments %j", (argv) => {
  const child = spawnSync(process.execPath, ["--no-env-file", "--no-install", join(fixture, "tooling/sbx-dev/acquire-tools.mjs"), ...argv],
    { env: process.env, encoding: "utf8", timeout: 5000 });
  expect(child.status).toBe(2);
  expect(child.stdout).toBe("");
  expect(child.stderr).toBe("STOP: acquire failed; retain private artifacts and reconcile before a new attempt.\n");
  expect(existsSync(intentPath)).toBe(false);
});

test("CLI non-TTY reports only stage, pins and manifest path and never executes mise", () => {
  const child = spawnSync(process.execPath, ["--no-env-file", "--no-install", join(fixture, "tooling/sbx-dev/acquire-tools.mjs"), "--manifest", manifestPath],
    { env: process.env, encoding: "utf8", timeout: 5000, input: "approve\n" });
  expect(child.status).toBe(2);
  expect(child.stdout).toBe(`STAGE=acquire\nBUN_VERSION=1.4.0\nRUST_VERSION=1.95.0\nMANIFEST_PATH=${manifestPath}\n`);
  expect(child.stderr).not.toContain("PRIVATE_MISE_LOG");
  expect(child.stderr).not.toContain("Type approve");
  expect(existsSync(intentPath)).toBe(false);
  expect(existsSync(bundlePath)).toBe(false);
});

test("regular archive files retain no source symlink metadata or privileged mode bits", async () => {
  chmodSync(join(sysroot, "bin/rustc"), 0o6755);
  const acquired = await acquire();
  expect(tarMembers(bundlePath).get("bin/rustc").mode).toBe(0o755);
  expect(lstatSync(bundlePath).isSymbolicLink()).toBe(false);
  await expect(checkBundle(bundlePath, "0".repeat(64))).rejects.toThrow("digest mismatch");
  await checkBundle(bundlePath, acquired.sha256);
});
