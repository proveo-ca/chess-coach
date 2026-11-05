// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { expect, test } from "bun:test";
import {
  artifactFileName, completeProfile, guestToolContext, validateCompleteProfile,
  validateGuestToolRoot, versionChecks,
} from "../complete-profile.mjs";

const ROOT = "/home/agent/workspace/devtools-0123456789abcdef";
const clone = () => structuredClone(completeProfile);

function reversed(value) {
  if (Array.isArray(value)) return value.map(reversed);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, item]) => [key, reversed(item)]));
  }
  return value;
}

test("built-in profile fixes the development envelope and tool order", () => {
  expect(completeProfile.schema).toBe("dev-sbx-complete-profile-v1");
  expect(completeProfile.id).toBe("complete-dev-v1");
  expect(completeProfile.platform).toBe("linux-x86_64-gnu");
  expect(completeProfile.limits).toEqual({ archiveBytes: 2147483648, totalArchiveBytes: 4294967296,
    expandedBytes: 17179869184, members: 200000, metadataBytes: 268435456, zipEntryBytes: 134217728 });
  expect(completeProfile.baseTools).toEqual(["tar", "sha256sum", "timeout", "gpgv", "patch", "make", "ld.bfd", "readelf", "node"]);
  expect(completeProfile.tools).toEqual(["tar", "sha256sum", "timeout", "gpgv", "patch", "make", "clang", "ld.bfd",
    "readelf", "node", "rustc", "cargo", "zig", "mise", "bun"]);
  expect(Object.keys(completeProfile).sort()).toEqual(["artifacts", "baseTools", "id", "limits", "platform", "schema", "tools"]);
});

test("artifact metadata keeps exact pins and URLs with unknown Rust byte size", () => {
  expect(completeProfile.artifacts.map(({ id, version, bytes, format, root }) => [id, version, bytes, format, root])).toEqual([
    ["bun", "1.4.0", 36697583, "zip", "bun-linux-x64-baseline"],
    ["rust", "1.95.0", null, "tar.xz", "rust-1.95.0-x86_64-unknown-linux-gnu"],
    ["zig", "0.17.1", 57411036, "tar.xz", "zig-x86_64-linux-0.17.1"],
    ["mise", "2026.11.2", 35899236, "tar.xz", "mise"],
    ["llvm", "23.1.5", 2014093084, "tar.xz", "LLVM-23.1.5-Linux-X64"],
  ]);
  expect(completeProfile.artifacts.map(({ url }) => url)).toEqual([
    "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-x64-baseline.zip",
    "https://static.rust-lang.org/dist/2026-04-16/rust-1.95.0-x86_64-unknown-linux-gnu.tar.xz",
    "https://ziglang.org/download/0.17.1/zig-x86_64-linux-0.17.1.tar.xz",
    "https://github.com/jdx/mise/releases/download/v2026.11.2/mise-v2026.11.2-linux-x64.tar.xz",
    "https://github.com/llvm/llvm-project/releases/download/llvmorg-23.1.5/LLVM-23.1.5-Linux-X64.tar.xz",
  ]);
  expect(completeProfile.artifacts.map(({ sha256 }) => sha256)).toEqual([
    "184fb4595f0d401a217cf7c78c1bc430ba83314dab7a8b94805babbf7fa7097f",
    "2e0338f18ecbaa4a0f631b9e80e8b8e26bb6fe77dd5454fba8a70cf96c1e84a1",
    "3581863e3cbcfd0fce0efc682ce7e9e93da96668a977791d356a26d2a7e9b17a",
    "9a1fedb31299e896d833dc49e6d6cfcb44aba138c6fc3562d8ee63ea6ab888c5",
    "f72edb0b36580ece7f52e23858f00c18fad4e87395ea7ad05d7e55c39f8fc78a",
  ]);
  for (const artifact of completeProfile.artifacts) {
    expect(artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(artifact).sort()).toEqual(["bytes", "format", "id", "root", "sha256", "url", "version"]);
  }
});

test("all profile objects freeze deeply while validation preserves caller identity and key order", () => {
  const frozen = (value) => {
    if (value === null || typeof value !== "object") return;
    expect(Object.isFrozen(value)).toBe(true);
    for (const item of Object.values(value)) frozen(item);
  };
  frozen(completeProfile);
  expect(validateCompleteProfile()).toBe(completeProfile);
  const value = reversed(clone()), before = JSON.stringify(value);
  expect(validateCompleteProfile(value)).toBe(value);
  expect(JSON.stringify(value)).toBe(before);
  expect(Object.isFrozen(value)).toBe(false);
  expect(() => { completeProfile.artifacts[0].version = "changed"; }).toThrow();
});

test.each([
  ["schema", (value) => { value.schema = "other"; }],
  ["id", (value) => { value.id = "other"; }],
  ["platform", (value) => { value.platform = "linux-arm64-gnu"; }],
  ["pin", (value) => { value.artifacts[0].version = "latest"; }],
  ["URL", (value) => { value.artifacts[0].url = "https://example.invalid/bun.zip"; }],
  ["malformed URL", (value) => { value.artifacts[0].url = "file:///tmp/bun.zip"; }],
  ["digest shape", (value) => { value.artifacts[0].sha256 = "g".repeat(64); }],
  ["different valid digest", (value) => { value.artifacts[0].sha256 = "a".repeat(64); }],
  ["inferred size", (value) => { value.artifacts[1].bytes = 1; }],
  ["root", (value) => { value.artifacts[0].root = "../bun"; }],
  ["format", (value) => { value.artifacts[0].format = "tar.xz"; }],
  ["artifact order", (value) => { value.artifacts.reverse(); }],
  ["tool order", (value) => { value.tools.reverse(); }],
  ["base tools", (value) => { value.baseTools.pop(); }],
  ["extra field", (value) => { value.extra = true; }],
  ["nested extra field", (value) => { value.artifacts[0].source = "https://example.invalid"; }],
  ["missing field", (value) => { delete value.artifacts[0].sha256; }],
  ["array property", (value) => { value.tools.extra = "bun"; }],
  ["sparse array", (value) => { delete value.tools[0]; }],
  ["trailing hole", (value) => { value.tools.length += 1; }],
  ["nested array", (value) => { value.tools[0] = ["tar"]; }],
  ["cycle", (value) => { value.limits = value; }],
])("%s cannot replace the built-in profile", (_name, change) => {
  const value = clone();
  change(value);
  expect(() => validateCompleteProfile(value)).toThrow();
});

test("every software envelope cap rejects changed and nonnumeric values", () => {
  for (const key of Object.keys(completeProfile.limits)) {
    for (const replacement of [completeProfile.limits[key] + 1, -1, null, NaN, Infinity, "2147483648"]) {
      const value = clone();
      value.limits[key] = replacement;
      expect(() => validateCompleteProfile(value)).toThrow();
    }
  }
});

test("prototype pollution, symbols, hidden fields, nonplain objects and accessors fail without invoking getters", () => {
  for (const change of [
    (value) => Object.setPrototypeOf(value, { inherited: true }),
    (value) => Object.setPrototypeOf(value.limits, null),
    (value) => Object.setPrototypeOf(value.tools, Object.create(Array.prototype)),
    (value) => Object.defineProperty(value, "__proto__", { value: {} }),
    (value) => { value.artifacts[0].constructor = {}; },
    (value) => { value[Symbol("extra")] = true; },
    (value) => Object.defineProperty(value, "hidden", { value: true }),
    (value) => Object.defineProperty(value, "id", { value: value.id, enumerable: false }),
    (value) => { value.limits = new Date(0); },
  ]) {
    const value = clone();
    change(value);
    expect(() => validateCompleteProfile(value)).toThrow();
  }
  let reads = 0;
  const value = clone();
  Object.defineProperty(value.artifacts[0], "url", { enumerable: true, get() { reads += 1; return "unused"; } });
  expect(() => validateCompleteProfile(value)).toThrow();
  expect(reads).toBe(0);
  for (const invalid of [null, [], 1, "profile", Object.create(null)]) expect(() => validateCompleteProfile(invalid)).toThrow();
});

test("filenames require the whole matching built-in artifact", () => {
  expect(completeProfile.artifacts.map(artifactFileName)).toEqual(["bun.zip", "rust.tar.xz", "zig.tar.xz", "mise.tar.xz", "llvm.tar.xz"]);
  expect(clone().artifacts.map(artifactFileName)).toEqual(completeProfile.artifacts.map(artifactFileName));
  for (const artifact of [null, "bun", { id: "bun" }, { ...completeProfile.artifacts[0], id: "../bun" },
    { ...completeProfile.artifacts[0], url: "https://example.invalid" },
    { ...completeProfile.artifacts[0], sha256: "a".repeat(64) }, { ...completeProfile.artifacts[0], extra: true }]) {
    expect(() => artifactFileName(artifact)).toThrow();
  }
});

test.each([
  undefined, null, 1, "", "/", "/home/agent/workspace", "/home/agent/workspace/devtools",
  ROOT + "/", ROOT + "\n", ROOT + "\0", ROOT + "x", ROOT.slice(0, -1), ROOT.toUpperCase(),
  ROOT.replace("workspace", "workspace/.."), ROOT.replace("/home/agent", "/tmp"),
  ROOT.replace("/workspace/", "/workspace//"), ROOT.replace("/devtools-", "/./devtools-"),
  ROOT.slice(0, -1) + "\ud800", ROOT.slice(0, -1) + "\u00e9", ROOT.slice(0, -1) + "\u007f",
  ROOT.slice(0, -1) + "\n", new String(ROOT),
])("guest root rejects %p", (root) => {
  expect(() => validateGuestToolRoot(root)).toThrow();
  expect(() => guestToolContext(root)).toThrow();
  expect(() => versionChecks(root)).toThrow();
});

test("guest context returns only root-scoped development paths and the fixed base PATH", () => {
  expect(validateGuestToolRoot(ROOT)).toBe(ROOT);
  const path = `${ROOT}/rust/bin:${ROOT}/bun/bin:${ROOT}/zig:${ROOT}/llvm/bin:${ROOT}/mise/bin:/usr/local/bin:/usr/bin:/bin`;
  expect(guestToolContext(ROOT)).toEqual({ root: ROOT, path, env: {
    PATH: path, HOME: `${ROOT}/home`, MISE_AUTO_INSTALL: "false", MISE_DATA_DIR: `${ROOT}/mise-data`,
    MISE_CONFIG_DIR: `${ROOT}/mise-config`, MISE_CACHE_DIR: `${ROOT}/mise-cache`,
    ZIG_GLOBAL_CACHE_DIR: `${ROOT}/zig-cache`, ZIG_LOCAL_CACHE_DIR: `${ROOT}/zig-local-cache`,
  } });
  const changed = guestToolContext(ROOT);
  changed.env.PATH = "changed";
  expect(guestToolContext(ROOT).env.PATH).toBe(path);
});

test("version probes contain six fixed genuine executable argv arrays without shell strings", () => {
  const expected = [
    { id: "bun", argv: [`${ROOT}/bun/bin/bun`, "--version"], version: "1.4.0" },
    { id: "rustc", argv: [`${ROOT}/rust/bin/rustc`, "-vV"], version: "1.95.0" },
    { id: "cargo", argv: [`${ROOT}/rust/bin/cargo`, "--version"], version: "1.95.0" },
    { id: "zig", argv: [`${ROOT}/zig/zig`, "version"], version: "0.17.1" },
    { id: "mise", argv: [`${ROOT}/mise/bin/mise`, "--version"], version: "2026.11.2" },
    { id: "clang", argv: [`${ROOT}/llvm/bin/clang`, "--version"], version: "23.1.5" },
  ];
  expect(versionChecks(ROOT)).toEqual(expected);
  const changed = versionChecks(ROOT);
  changed[0].argv[0] = "changed";
  expect(versionChecks(ROOT)).toEqual(expected);
});
