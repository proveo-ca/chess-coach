// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml

function freeze(value) {
  if (value !== null && typeof value === "object") {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}

export const completeProfile = freeze({
  schema: "dev-sbx-complete-profile-v1",
  id: "complete-dev-v1",
  platform: "linux-x86_64-gnu",
  limits: {
    archiveBytes: 2147483648,
    totalArchiveBytes: 4294967296,
    expandedBytes: 17179869184,
    members: 200000,
    metadataBytes: 268435456,
    zipEntryBytes: 134217728,
  },
  artifacts: [
    {
      id: "bun", version: "1.4.0",
      url: "https://github.com/oven-sh/bun/releases/download/bun-v1.4.0/bun-linux-x64-baseline.zip",
      sha256: "184fb4595f0d401a217cf7c78c1bc430ba83314dab7a8b94805babbf7fa7097f",
      bytes: 36697583, format: "zip", root: "bun-linux-x64-baseline",
    },
    {
      id: "rust", version: "1.95.0",
      url: "https://static.rust-lang.org/dist/2026-04-16/rust-1.95.0-x86_64-unknown-linux-gnu.tar.xz",
      sha256: "2e0338f18ecbaa4a0f631b9e80e8b8e26bb6fe77dd5454fba8a70cf96c1e84a1",
      bytes: null, format: "tar.xz", root: "rust-1.95.0-x86_64-unknown-linux-gnu",
    },
    {
      id: "zig", version: "0.17.1",
      url: "https://ziglang.org/download/0.17.1/zig-x86_64-linux-0.17.1.tar.xz",
      sha256: "3581863e3cbcfd0fce0efc682ce7e9e93da96668a977791d356a26d2a7e9b17a",
      bytes: 57411036, format: "tar.xz", root: "zig-x86_64-linux-0.17.1",
    },
    {
      id: "mise", version: "2026.11.2",
      url: "https://github.com/jdx/mise/releases/download/v2026.11.2/mise-v2026.11.2-linux-x64.tar.xz",
      sha256: "9a1fedb31299e896d833dc49e6d6cfcb44aba138c6fc3562d8ee63ea6ab888c5",
      bytes: 35899236, format: "tar.xz", root: "mise",
    },
    {
      id: "llvm", version: "23.1.5",
      url: "https://github.com/llvm/llvm-project/releases/download/llvmorg-23.1.5/LLVM-23.1.5-Linux-X64.tar.xz",
      sha256: "f72edb0b36580ece7f52e23858f00c18fad4e87395ea7ad05d7e55c39f8fc78a",
      bytes: 2014093084, format: "tar.xz", root: "LLVM-23.1.5-Linux-X64",
    },
  ],
  baseTools: ["tar", "sha256sum", "timeout", "gpgv", "patch", "make", "ld.bfd", "readelf", "node"],
  tools: [
    "tar", "sha256sum", "timeout", "gpgv", "patch", "make", "clang", "ld.bfd",
    "readelf", "node", "rustc", "cargo", "zig", "mise", "bun",
  ],
});

function canonical(value, expected) {
  if (expected === null) {
    if (value !== null) throw new Error("invalid complete profile data");
    return "null";
  }
  if (typeof expected !== "object") {
    if (typeof value !== typeof expected) throw new Error("invalid complete profile data");
    return JSON.stringify(value);
  }
  const array = Array.isArray(expected);
  if (value === null || typeof value !== "object" || Array.isArray(value) !== array
    || Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) {
    throw new Error("plain complete profile data required");
  }
  const keys = Reflect.ownKeys(value);
  const expectedKeys = Reflect.ownKeys(expected);
  if (keys.length !== expectedKeys.length
    || keys.some((key) => typeof key !== "string" || !Object.hasOwn(expected, key))) {
    throw new Error("unexpected complete profile fields");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (array && descriptors.length.value !== expected.length) throw new Error("invalid complete profile array");
  const ordered = array ? Array.from({ length: expected.length }, (_, index) => String(index)) : keys.sort();
  const fields = ordered.map((key) => {
    const field = descriptors[key];
    if (!Object.hasOwn(descriptors, key) || !Object.hasOwn(field, "value") || !field.enumerable) {
      throw new Error("own enumerable complete profile data required");
    }
    const content = canonical(field.value, expected[key]);
    return array ? content : `${JSON.stringify(key)}:${content}`;
  });
  return array ? `[${fields.join(",")}]` : `{${fields.join(",")}}`;
}

const PROFILE_VALUE = canonical(completeProfile, completeProfile);

export function validateCompleteProfile(value = completeProfile) {
  if (canonical(value, completeProfile) !== PROFILE_VALUE) throw new Error("built-in complete profile required");
  return value;
}

export function validateGuestToolRoot(root) {
  const prefix = "/home/agent/workspace/devtools-";
  if (typeof root !== "string" || root.length !== prefix.length + 16 || !root.startsWith(prefix)
    || !/^[0-9a-f]{16}$/.test(root.slice(prefix.length))) throw new Error("exact guest tool root required");
  return root;
}

export function guestToolContext(root) {
  validateGuestToolRoot(root);
  const path = `${root}/rust/bin:${root}/bun/bin:${root}/zig:${root}/llvm/bin:${root}/mise/bin:/usr/local/bin:/usr/bin:/bin`;
  return {
    root, path,
    env: {
      PATH: path,
      HOME: `${root}/home`,
      MISE_AUTO_INSTALL: "false",
      MISE_DATA_DIR: `${root}/mise-data`,
      MISE_CONFIG_DIR: `${root}/mise-config`,
      MISE_CACHE_DIR: `${root}/mise-cache`,
      ZIG_GLOBAL_CACHE_DIR: `${root}/zig-cache`,
      ZIG_LOCAL_CACHE_DIR: `${root}/zig-local-cache`,
    },
  };
}

export function artifactFileName(artifact) {
  if (artifact === null || typeof artifact !== "object") throw new Error("built-in artifact required");
  const id = Object.getOwnPropertyDescriptor(artifact, "id")?.value;
  const matched = completeProfile.artifacts.find((candidate) => candidate.id === id);
  if (!matched || canonical(artifact, matched) !== canonical(matched, matched)) throw new Error("built-in artifact required");
  return `${matched.id}.${matched.format === "zip" ? "zip" : "tar.xz"}`;
}

export function versionChecks(root) {
  validateGuestToolRoot(root);
  return [
    { id: "bun", argv: [`${root}/bun/bin/bun`, "--version"], version: "1.4.0" },
    { id: "rustc", argv: [`${root}/rust/bin/rustc`, "-vV"], version: "1.95.0" },
    { id: "cargo", argv: [`${root}/rust/bin/cargo`, "--version"], version: "1.95.0" },
    { id: "zig", argv: [`${root}/zig/zig`, "version"], version: "0.17.1" },
    { id: "mise", argv: [`${root}/mise/bin/mise`, "--version"], version: "2026.11.2" },
    { id: "clang", argv: [`${root}/llvm/bin/clang`, "--version"], version: "23.1.5" },
  ];
}
