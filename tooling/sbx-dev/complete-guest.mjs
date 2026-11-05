#!/usr/bin/env bun
// SPEC: _spec/tooling/sbx-dev/preparation-workflow.puml
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync,
  openSync, readdirSync, readlinkSync, readSync, writeFileSync, writeSync,
} from "node:fs";
import { isAbsolute, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  artifactFileName, completeProfile, guestToolContext, validateGuestToolRoot, versionChecks,
} from "./complete-profile.mjs";
import { inspectZipArchive, TarInspector } from "./complete-archive.mjs";

const SCHEMA = "dev-sbx-complete-guest-v1";
const ACTIONS = ["inspect", "install", "verify"];
const IDS = ["bun", "rust", "zig", "mise", "llvm"];
const SHA = /^[0-9a-f]{64}$/;
const RECORD_CAP = 256 * 1024;
const COMMAND_CAP = 16 * 1024;
const MANIFEST_CAP = 1024 * 1024;
const CONTROL_BYTES = 2 * 1024 * 1024;
const CONTROL_MEMBERS = 64;
const HOST = "x86_64-unknown-linux-gnu";
const COMPONENTS = ["rustc", "cargo", `rust-std-${HOST}`, "rustfmt-preview", "clippy-preview"];
const SOURCE_NAMES = ["complete-profile.mjs", "complete-archive.mjs", "complete-guest.mjs"];
const ROOTS = {
  bun: "bun-linux-x64-baseline", rust: `rust-1.95.0-${HOST}`,
  zig: "zig-x86_64-linux-0.17.1", mise: "mise", llvm: "LLVM-23.1.5-Linux-X64",
};
const TARGETS = { bun: "bun", rust: "rust-dist", zig: "zig", mise: "mise", llvm: "llvm" };
const CODES = new Set([
  "INVALID_ARGUMENTS", "INVALID_PROFILE", "INVALID_ROOT", "INVALID_PRIVATE_FILE", "FILE_CHANGED",
  "INVALID_RESERVATION", "UNEXPECTED_LEFTOVERS", "STAGE_ALREADY_ATTEMPTED", "INVALID_RECEIPT",
  "INPUT_INTEGRITY", "CAPACITY_EXCEEDED", "UNSUPPORTED_LAYOUT", "UNSAFE_PATH", "TARGET_EXISTS",
  "ARCHIVE_REJECTED", "COMMAND_FAILED", "INVALID_MANIFEST", "FILE_COLLISION", "INVALID_VERSION",
  "MISSING_RESOURCE", "MISSING_TOOLS", "INVALID_CONTEXT", "GUEST_STAGE_FAILED",
]);

class GuestFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

function fail(code) { throw new GuestFailure(code); }
function hash(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
export function completeProfileSha256() { return hash(JSON.stringify(completeProfile)); }
function sameKeys(value, keys) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
}
function canonical(path) {
  if (typeof path !== "string" || path.length > 4096 || !isAbsolute(path) || resolve(path) !== path
    || /[\x00-\x20\x7f]/.test(path)) fail("INVALID_ROOT");
  return path;
}
function relativePath(path, allowEmpty = false) {
  if (allowEmpty && path === "") return path;
  if (typeof path !== "string" || path.length > 4096 || /[\\\x00-\x1f\x7f]/.test(path)
    || path.split("/").some((part) => !part || part === "." || part === "..")) fail("UNSAFE_PATH");
  return path;
}
function stable(before, after) {
  return ["dev", "ino", "size", "mtimeNs", "ctimeNs", "mode", "uid", "gid", "nlink"]
    .every((key) => before[key] === after[key]);
}
function assertStable(fd, before) {
  if (!stable(before, fstatSync(fd, { bigint: true }))) fail("FILE_CHANGED");
}
function privateDetails(fd, cap, mode = 0o400) {
  const details = fstatSync(fd, { bigint: true });
  if (!details.isFile() || details.uid !== BigInt(process.getuid()) || details.nlink !== 1n
    || (details.mode & 0o7777n) !== BigInt(mode) || details.size > BigInt(cap)) fail("INVALID_PRIVATE_FILE");
  return details;
}
function boundedRead(fd, cap, details = fstatSync(fd, { bigint: true })) {
  if (!details.isFile() || details.size > BigInt(cap)) fail("INVALID_PRIVATE_FILE");
  const bytes = Buffer.alloc(Number(details.size) + 1);
  let offset = 0;
  while (offset < bytes.length) {
    const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
    if (!count) break;
    offset += count;
  }
  if (offset !== Number(details.size)) fail("FILE_CHANGED");
  assertStable(fd, details);
  return bytes.subarray(0, offset);
}
function hashFile(fd, details) {
  const digest = createHash("sha256");
  const chunk = Buffer.alloc(1024 * 1024);
  let offset = 0;
  while (offset < Number(details.size)) {
    const count = readSync(fd, chunk, 0, Math.min(chunk.length, Number(details.size) - offset), offset);
    if (!count) fail("FILE_CHANGED");
    digest.update(chunk.subarray(0, count));
    offset += count;
  }
  if (readSync(fd, chunk, 0, 1, offset) !== 0) fail("FILE_CHANGED");
  assertStable(fd, details);
  return digest.digest("hex");
}

class PrivateTree {
  constructor(root) {
    this.root = canonical(root);
    let fd = openSync("/", constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try {
      for (const name of root.slice(1).split("/")) {
        const next = openSync(`/proc/self/fd/${fd}/${name}`,
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        closeSync(fd);
        fd = next;
      }
      const details = fstatSync(fd, { bigint: true });
      if (details.uid !== BigInt(process.getuid()) || (details.mode & 0o7777n) !== 0o700n) fail("INVALID_ROOT");
      this.fd = fd;
      this.identity = details;
    } catch (error) { closeSync(fd); throw error; }
  }
  close() { closeSync(this.fd); }
  assert() {
    const details = fstatSync(this.fd, { bigint: true });
    const selected = lstatSync(this.root, { bigint: true });
    if (details.dev !== this.identity.dev || details.ino !== this.identity.ino
      || selected.dev !== details.dev || selected.ino !== details.ino || !selected.isDirectory()
      || details.uid !== BigInt(process.getuid()) || (details.mode & 0o7777n) !== 0o700n) fail("INVALID_ROOT");
  }
  directory(path = "") {
    relativePath(path, true);
    let fd = openSync(`/proc/self/fd/${this.fd}`, constants.O_RDONLY | constants.O_DIRECTORY);
    try {
      for (const name of path ? path.split("/") : []) {
        const next = openSync(`/proc/self/fd/${fd}/${name}`,
          constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        const details = fstatSync(next, { bigint: true });
        if (details.uid !== BigInt(process.getuid())) { closeSync(next); fail("UNSAFE_PATH"); }
        closeSync(fd);
        fd = next;
      }
      return fd;
    } catch (error) { closeSync(fd); throw error; }
  }
  at(path, operation) {
    relativePath(path);
    const parent = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const name = path.slice(path.lastIndexOf("/") + 1);
    const fd = this.directory(parent);
    try { return operation(`/proc/self/fd/${fd}/${name}`, fd); }
    finally { closeSync(fd); }
  }
  stat(path) { return this.at(path, (selected) => lstatSync(selected, { bigint: true })); }
  absent(path, code = "TARGET_EXISTS") {
    try { this.stat(path); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    fail(code);
  }
  list(path = "") {
    const fd = this.directory(path);
    try { return readdirSync(`/proc/self/fd/${fd}`).sort(); }
    finally { closeSync(fd); }
  }
  file(path) {
    return this.at(path, (selected) => openSync(selected, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK));
  }
  read(path, cap = RECORD_CAP, mode = 0o400) {
    const fd = this.file(path);
    try { return boundedRead(fd, cap, privateDetails(fd, cap, mode)); }
    finally { closeSync(fd); }
  }
  mkdir(path) { this.at(path, (selected) => mkdirSync(selected, { mode: 0o700 })); }
  ensureDirectory(path) {
    relativePath(path);
    let prefix = "";
    for (const name of path.split("/")) {
      prefix = prefix ? `${prefix}/${name}` : name;
      try { this.mkdir(prefix); }
      catch (error) { if (error.code !== "EEXIST") throw error; }
      const fd = this.directory(prefix);
      try {
        if ((fstatSync(fd, { bigint: true }).mode & 0o022n) !== 0n) fail("UNSAFE_PATH");
      } finally { closeSync(fd); }
    }
  }
  exclusive(path, bytes, mode = 0o400) {
    this.at(path, (selected, parent) => {
      let fd;
      try {
        fd = openSync(selected, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        writeFileSync(fd, bytes);
        fchmodSync(fd, mode);
        fsyncSync(fd);
        fsyncSync(parent);
      } finally { if (fd !== undefined) closeSync(fd); }
    });
  }
}

function profileArtifacts() {
  const profile = completeProfile;
  if (profile.schema !== "dev-sbx-complete-profile-v1" || profile.id !== "complete-dev-v1"
    || profile.platform !== "linux-x86_64-gnu" || !Array.isArray(profile.artifacts)
    || profile.artifacts.length !== IDS.length) fail("INVALID_PROFILE");
  const artifacts = IDS.map((id) => {
    const matches = profile.artifacts.filter((artifact) => artifact.id === id);
    if (matches.length !== 1) fail("INVALID_PROFILE");
    const artifact = matches[0];
    if (artifact.root !== ROOTS[id] || artifact.format !== (id === "bun" ? "zip" : "tar.xz")
      || !SHA.test(artifact.sha256) || (artifact.bytes !== null && artifact.bytes !== undefined
        && (!Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0 || artifact.bytes > profile.limits.archiveBytes))
      || ((artifact.bytes === null || artifact.bytes === undefined) && id !== "rust")) fail("INVALID_PROFILE");
    if (artifactFileName(artifact) !== `${id}.${artifact.format}`) fail("INVALID_PROFILE");
    return artifact;
  });
  const limits = profile.limits;
  if (!limits || limits.archiveBytes !== 2 * 1024 ** 3 || limits.totalArchiveBytes !== 4 * 1024 ** 3
    || limits.expandedBytes !== 16 * 1024 ** 3 || limits.members !== 200000
    || limits.metadataBytes !== 256 * 1024 ** 2 || limits.zipEntryBytes !== 128 * 1024 ** 2) fail("INVALID_PROFILE");
  return artifacts;
}

export function accountCapacity(current, added, limits = completeProfile.limits) {
  const result = {};
  for (const [key, cap] of [["bytes", limits.expandedBytes], ["members", limits.members]]) {
    if (!Number.isSafeInteger(current[key]) || current[key] < 0 || !Number.isSafeInteger(added[key])
      || added[key] < 0 || current[key] > cap - added[key]) fail("CAPACITY_EXCEEDED");
    result[key] = current[key] + added[key];
  }
  return result;
}

export function accountMetadataBytes(current, added, cap = completeProfile.limits.metadataBytes) {
  if (![current, added, cap].every(Number.isSafeInteger) || current < 0 || added < 0 || cap < 1
    || cap > completeProfile.limits.metadataBytes || added > cap - current) fail("CAPACITY_EXCEEDED");
  return current + added;
}

export function bunDestinations(entries, archiveRoot = ROOTS.bun) {
  const names = new Map();
  const result = [];
  for (const entry of entries) {
    relativePath(entry.path);
    if (entry.path === archiveRoot && entry.type === "directory") continue;
    if (!entry.path.startsWith(`${archiveRoot}/`) || !["file", "directory"].includes(entry.type)) fail("UNSUPPORTED_LAYOUT");
    const suffix = relativePath(entry.path.slice(archiveRoot.length + 1));
    const path = suffix === "bun" ? "bun/bin/bun" : `bun/${suffix}`;
    if (names.has(path)) fail("FILE_COLLISION");
    names.set(path, entry.type);
    result.push({ path, entry });
  }
  for (const [path] of names) {
    for (let parent = posix.dirname(path); parent !== "."; parent = posix.dirname(parent)) {
      if (names.has(parent) && names.get(parent) !== "directory") fail("FILE_COLLISION");
    }
  }
  if (names.get("bun/bin/bun") !== "file") fail("UNSUPPORTED_LAYOUT");
  return result;
}

export function validateArtifactLayout(artifact, inspection) {
  if (!inspection || !Array.isArray(inspection.entries) || !Number.isSafeInteger(inspection.bytes)
    || inspection.bytes < 0 || !Number.isSafeInteger(inspection.members) || inspection.members < inspection.entries.length) fail("ARCHIVE_REJECTED");
  const paths = new Map();
  let sizes = 0;
  for (const entry of inspection.entries) {
    relativePath(entry.path);
    if ((entry.path !== artifact.root && !entry.path.startsWith(`${artifact.root}/`)) || paths.has(entry.path)
      || !["file", "directory", "symlink", "hardlink"].includes(entry.type)
      || !Number.isSafeInteger(entry.size) || entry.size < 0 || !Number.isInteger(entry.mode)
      || entry.mode < 0 || (entry.mode & ~0o777) !== 0) fail("ARCHIVE_REJECTED");
    if (entry.type === "file") sizes += entry.size;
    if (!Number.isSafeInteger(sizes)) fail("CAPACITY_EXCEEDED");
    paths.set(entry.path, entry);
  }
  const effectiveTypes = validateStrippedLinks(artifact.root, paths);
  const has = (suffix, type) => effectiveTypes.get(suffix) === type;
  const prefix = (suffix) => [...paths.keys()].some((path) => path.startsWith(`${artifact.root}/${suffix}/`));
  const notices = [...paths.values()].filter((entry) => entry.type === "file"
    && /^(licen[cs]e|copying|copyright|notice)([._-]|$)/i.test(posix.basename(entry.path)));
  if (!notices.length) fail("UNSUPPORTED_LAYOUT");
  if (artifact.id === "bun") {
    bunDestinations(inspection.entries, artifact.root);
    for (const entry of inspection.entries) {
      if (entry.type === "file" && (!Buffer.isBuffer(entry.content) || entry.content.length !== entry.size)) fail("ARCHIVE_REJECTED");
    }
  } else if (artifact.id === "rust") {
    if (!COMPONENTS.every((component) => has(`${component}/manifest.in`, "file"))
      || !has("rustc/bin/rustc", "file") || !has("cargo/bin/cargo", "file")
      || !has("rustfmt-preview/bin/rustfmt", "file") || !has("clippy-preview/bin/clippy-driver", "file")
      || !has("clippy-preview/bin/cargo-clippy", "file")
      || !prefix(`rust-std-${HOST}/lib/rustlib/${HOST}/lib`)) fail("UNSUPPORTED_LAYOUT");
  } else if (artifact.id === "zig") {
    if (!has("zig", "file") || !prefix("lib")) fail("UNSUPPORTED_LAYOUT");
  } else if (artifact.id === "mise") {
    if (!has("bin/mise", "file")) fail("UNSUPPORTED_LAYOUT");
  } else if (artifact.id === "llvm") {
    if (!has("bin/clang", "file") || !prefix("lib/clang/23/include")) fail("UNSUPPORTED_LAYOUT");
  } else fail("UNSUPPORTED_LAYOUT");
  const target = TARGETS[artifact.id], materialized = new Set([target]);
  const destinations = artifact.id === "bun" ? bunDestinations(inspection.entries, artifact.root)
    : inspection.entries.filter((entry) => entry.path !== artifact.root)
      .map((entry) => ({ path: `${target}/${entry.path.slice(artifact.root.length + 1)}` }));
  if (artifact.id === "bun") materialized.add("bun/bin");
  for (const { path } of destinations) {
    for (let selected = path; selected !== "."; selected = posix.dirname(selected)) {
      materialized.add(selected);
      if (materialized.size > completeProfile.limits.members) fail("CAPACITY_EXCEEDED");
    }
  }
  return { bytes: Math.max(sizes, inspection.bytes), members: Math.max(inspection.members, materialized.size), notices: notices.length };
}

function validateStrippedLinks(root, paths) {
  const stripped = new Map();
  for (const [path, entry] of paths) {
    if (path === root) {
      if (entry.type !== "directory") fail("ARCHIVE_REJECTED");
      continue;
    }
    stripped.set(relativePath(path.slice(root.length + 1)), entry);
  }
  const directories = new Set(["."]);
  for (const [path, entry] of stripped) {
    if (entry.type === "directory") directories.add(path);
    for (let parent = posix.dirname(path); parent !== "."; parent = posix.dirname(parent)) {
      directories.add(parent);
      if (directories.size > completeProfile.limits.members) fail("CAPACITY_EXCEEDED");
      if (stripped.has(parent) && stripped.get(parent).type !== "directory") fail("UNSAFE_PATH");
    }
  }
  function target(path, chain = new Set()) {
    if (chain.has(path) || chain.size >= 64) fail("UNSAFE_PATH");
    const entry = stripped.get(path);
    if (!entry) { if (directories.has(path)) return "directory"; fail("UNSAFE_PATH"); }
    if (!["symlink", "hardlink"].includes(entry.type)) return entry.type;
    const link = entry.link;
    if (typeof link !== "string" || !link || link.length > 4096 || isAbsolute(link) || /[\\\x00-\x1f\x7f]/.test(link)) fail("UNSAFE_PATH");
    let selected;
    if (entry.type === "hardlink") {
      relativePath(link);
      if (!link.startsWith(`${root}/`)) fail("UNSAFE_PATH");
      selected = link.slice(root.length + 1);
    } else selected = posix.normalize(posix.join(posix.dirname(path), link));
    if (selected === ".." || selected.startsWith("../") || selected.startsWith("/")) fail("UNSAFE_PATH");
    const kind = target(selected, new Set([...chain, path]));
    if (entry.type === "hardlink" && kind !== "file") fail("UNSAFE_PATH");
    return kind;
  }
  const types = new Map();
  for (const [path] of stripped) types.set(path, target(path));
  return types;
}

async function nativeExecute(argv, bounds) {
  return await new Promise((finish) => {
    let child, deadline, reap, done = false, killed = false, failure = false;
    let stdout = "", stderr = "", retainedBytes = 0;
    const settle = (result) => {
      if (done) return;
      done = true;
      clearTimeout(deadline);
      clearTimeout(reap);
      process.off("SIGINT", interrupt);
      process.off("SIGTERM", interrupt);
      child?.stdout?.destroy();
      child?.stderr?.destroy();
      finish(result);
    };
    const stop = () => {
      failure = true;
      if (killed || done) return;
      killed = true;
      if (child?.pid) { try { process.kill(-child.pid, "SIGKILL"); } catch {} }
      reap = setTimeout(() => settle({ ok: false, outcome: "STOP", code: null, signal: null, stdout: "", stderr: "" }), 2000);
    };
    const interrupt = () => stop();
    try {
      child = spawn(argv[0], argv.slice(1), {
        detached: true, env: bounds.env, cwd: "/", windowsHide: true,
        stdio: ["ignore", "pipe", "pipe", bounds.fd ?? "ignore", bounds.destinationFd ?? "ignore"],
      });
      process.on("SIGINT", interrupt);
      process.on("SIGTERM", interrupt);
      deadline = setTimeout(stop, bounds.milliseconds);
      child.stdout.on("data", (chunk) => {
        if (failure || done) return;
        try {
          if (bounds.onStdout) bounds.onStdout(chunk);
          else {
            retainedBytes += chunk.length;
            if (retainedBytes > bounds.cap) return stop();
            stdout += chunk.toString("utf8");
          }
        } catch { stop(); }
      });
      child.stderr.on("data", (chunk) => {
        if (failure || done) return;
        retainedBytes += chunk.length;
        if (retainedBytes > bounds.cap) return stop();
        stderr += chunk.toString("utf8");
      });
      child.once("error", stop);
      child.once("close", (code, signal) => settle({
        ok: !failure && code === 0 && signal === null, outcome: failure ? "STOP" : "EXIT", code, signal,
        stdout: failure ? "" : stdout, stderr: failure ? "" : stderr,
      }));
    } catch { stop(); }
  });
}

async function checkedExecute(execute, argv, bounds) {
  let result;
  try { result = await execute(argv, bounds); }
  catch { fail("COMMAND_FAILED"); }
  if (!result || result.ok !== true || result.outcome !== "EXIT" || result.code !== 0 || result.signal !== null
    || typeof result.stdout !== "string" || typeof result.stderr !== "string"
    || Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr) > bounds.cap) fail("COMMAND_FAILED");
  return result;
}

async function nativeDecode(artifact, { fd, onChunk, env }) {
  if (artifact.format !== "tar.xz") fail("ARCHIVE_REJECTED");
  await checkedExecute(nativeExecute, ["/usr/bin/xz", "--decompress", "--stdout", "/proc/self/fd/3"], {
    fd, env, onStdout: onChunk, milliseconds: 1200000, cap: COMMAND_CAP,
  });
}

function record(tree, action, profileSha256, data, kind = "receipt") {
  const value = {
    schema: SCHEMA, action, root: tree.root, profileSha256, result: kind === "receipt" ? "PASS" : "INTENT",
    gate0: "OPEN", f9Qualified: false, trainingReady: false, data,
  };
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  if (bytes.length > RECORD_CAP) fail("CAPACITY_EXCEEDED");
  tree.exclusive(`${action}.${kind === "intent" ? "intent" : "receipt.json"}`, bytes);
  tree.assert();
  return value;
}

function readRecord(tree, action, profileSha256, kind = "receipt") {
  let value;
  try { value = JSON.parse(tree.read(`${action}.${kind === "intent" ? "intent" : "receipt.json"}`).toString("utf8")); }
  catch { fail("INVALID_RECEIPT"); }
  if (!sameKeys(value, ["schema", "action", "root", "profileSha256", "result", "gate0", "f9Qualified", "trainingReady", "data"])
    || value.schema !== SCHEMA || value.action !== action || value.root !== tree.root || value.profileSha256 !== profileSha256
    || value.result !== (kind === "intent" ? "INTENT" : "PASS") || value.gate0 !== "OPEN"
    || value.f9Qualified !== false || value.trainingReady !== false || !value.data || typeof value.data !== "object") fail("INVALID_RECEIPT");
  if (kind === "intent" && !sameKeys(value.data, [])) fail("INVALID_RECEIPT");
  if (kind === "receipt" && action !== "verify") validateSummary(value.data, action === "install");
  return value;
}

function validateSummary(summary, installed = false) {
  const keys = ["inputs", "archiveBytes", "expandedBytes", "members", "metadataBytes", "controlReserveBytes", "controlReserveMembers"];
  if (installed) keys.push("rustCopiedBytes", "rustCopiedMembers");
  if (!sameKeys(summary, keys) || !Array.isArray(summary.inputs) || summary.inputs.length !== IDS.length
    || summary.controlReserveBytes !== CONTROL_BYTES || summary.controlReserveMembers !== CONTROL_MEMBERS) fail("INVALID_RECEIPT");
  const limits = completeProfile.limits;
  for (const [key, max] of [["archiveBytes", limits.totalArchiveBytes], ["expandedBytes", limits.expandedBytes],
    ["members", limits.members], ["metadataBytes", limits.metadataBytes]]) {
    if (!Number.isSafeInteger(summary[key]) || summary[key] < 0 || summary[key] > max) fail("INVALID_RECEIPT");
  }
  if (installed && (!Number.isSafeInteger(summary.rustCopiedBytes) || summary.rustCopiedBytes < 0
    || summary.rustCopiedBytes > summary.expandedBytes || !Number.isSafeInteger(summary.rustCopiedMembers)
    || summary.rustCopiedMembers < 1 || summary.rustCopiedMembers > summary.members)) fail("INVALID_RECEIPT");
  let archiveBytes = 0;
  let expandedBytes = CONTROL_BYTES;
  let members = CONTROL_MEMBERS;
  const artifacts = profileArtifacts();
  for (let i = 0; i < IDS.length; i++) {
    const input = summary.inputs[i];
    const artifact = artifacts[i];
    if (!sameKeys(input, ["id", "sha256", "bytes", "expandedBytes", "members", "notices"])
      || input.id !== artifact.id || input.sha256 !== artifact.sha256 || !Number.isSafeInteger(input.bytes)
      || input.bytes < 1 || input.bytes > limits.archiveBytes
      || (artifact.bytes !== null && artifact.bytes !== undefined && input.bytes !== artifact.bytes)
      || !Number.isSafeInteger(input.expandedBytes) || input.expandedBytes < 1 || input.expandedBytes > limits.expandedBytes
      || !Number.isSafeInteger(input.members) || input.members < 1 || input.members > limits.members
      || !Number.isSafeInteger(input.notices) || input.notices < 1 || input.notices > input.members) fail("INVALID_RECEIPT");
    archiveBytes += input.bytes;
    expandedBytes += input.expandedBytes;
    members += input.members;
  }
  if (archiveBytes !== summary.archiveBytes || expandedBytes > summary.expandedBytes || members > summary.members) fail("INVALID_RECEIPT");
}

function validateReservation(tree, profileSha256) {
  const attempt = tree.root.slice(-16);
  if (!/^[0-9a-f]{16}$/.test(attempt)
    || !tree.read(".reservation", 512).equals(Buffer.from(`${completeProfile.id}\n${profileSha256}\n${attempt}\n`))) fail("INVALID_RESERVATION");
  const inputs = tree.directory("inputs");
  try {
    const details = fstatSync(inputs, { bigint: true });
    if ((details.mode & 0o7777n) !== 0o700n) fail("INVALID_PRIVATE_FILE");
  } finally { closeSync(inputs); }
}

function validateStageTree(tree, action, profileSha256) {
  tree.absent(`${action}.intent`, "STAGE_ALREADY_ATTEMPTED");
  const allowed = [".reservation", "inputs"];
  for (const prior of ACTIONS.slice(0, ACTIONS.indexOf(action))) {
    readRecord(tree, prior, profileSha256, "intent");
    readRecord(tree, prior, profileSha256);
    allowed.push(`${prior}.intent`, `${prior}.receipt.json`);
  }
  if (action === "verify") allowed.push(...Object.values(TARGETS), "rust");
  if (tree.list().join("\n") !== allowed.sort().join("\n")) fail("UNEXPECTED_LEFTOVERS");
  if (action === "verify") {
    const inspected = readRecord(tree, "inspect", profileSha256).data;
    const installed = readRecord(tree, "install", profileSha256).data;
    const { rustCopiedBytes, rustCopiedMembers, ...base } = installed;
    if (JSON.stringify({ ...base, expandedBytes: installed.expandedBytes - rustCopiedBytes,
      members: installed.members - rustCopiedMembers }) !== JSON.stringify(inspected)) fail("INVALID_RECEIPT");
  }
  if (action === "install") {
    for (const path of [...Object.values(TARGETS), "rust"]) tree.absent(path);
  }
}

function openInputs(tree, artifacts) {
  const expected = [...SOURCE_NAMES, "bun-bootstrap", ...artifacts.map(artifactFileName)].sort();
  if (tree.list("inputs").join("\n") !== expected.join("\n")) fail("UNEXPECTED_LEFTOVERS");
  const held = [];
  let seeded = { bytes: CONTROL_BYTES, members: CONTROL_MEMBERS + 2 + expected.length };
  try {
    for (const name of [...SOURCE_NAMES, "bun-bootstrap"]) {
      const fd = tree.file(`inputs/${name}`);
      try {
        const details = privateDetails(fd, name === "bun-bootstrap" ? 128 * 1024 ** 2 : 4 * 1024 ** 2,
          name === "bun-bootstrap" ? 0o500 : 0o400);
        hashFile(fd, details);
        seeded = accountCapacity(seeded, { bytes: Number(details.size), members: 0 });
      } finally { closeSync(fd); }
    }
    let total = 0;
    for (const artifact of artifacts) {
      const fd = tree.file(`inputs/${artifactFileName(artifact)}`);
      held.push({ artifact, fd });
      const details = privateDetails(fd, completeProfile.limits.archiveBytes);
      if (details.size <= 0n || (artifact.bytes !== null && artifact.bytes !== undefined && details.size !== BigInt(artifact.bytes))) fail("INPUT_INTEGRITY");
      total += Number(details.size);
      if (total > completeProfile.limits.totalArchiveBytes) fail("CAPACITY_EXCEEDED");
      const sha256 = hashFile(fd, details);
      if (sha256 !== artifact.sha256) fail("INPUT_INTEGRITY");
      Object.assign(held.at(-1), { details, summary: { id: artifact.id, sha256, bytes: Number(details.size) } });
    }
    return { held, seeded, archiveBytes: total };
  } catch (error) { for (const input of held) closeSync(input.fd); throw error; }
}

async function inspectInputs(inputs, decode, env) {
  let counts = inputs.seeded;
  let metadataBytes = 0;
  const summaries = [];
  for (const input of inputs.held) {
    const { artifact, fd, details } = input;
    const limits = completeProfile.limits;
    assertStable(fd, details);
    const remainingBytes = limits.expandedBytes - counts.bytes;
    const remainingMembers = limits.members - counts.members;
    const remainingMetadata = limits.metadataBytes - metadataBytes;
    let inspection;
    try {
      if (artifact.format === "zip") {
        inspection = inspectZipArchive(boundedRead(fd, Number(details.size), details), {
          root: artifact.root, maxBytes: Math.min(remainingBytes, limits.zipEntryBytes), maxMembers: remainingMembers,
          maxMetadataBytes: remainingMetadata, maxEntryBytes: limits.zipEntryBytes,
        });
      } else if (artifact.format === "tar.xz") {
        const inspector = new TarInspector({ root: artifact.root, maxBytes: remainingBytes,
          maxMembers: remainingMembers, maxMetadataBytes: remainingMetadata });
        await decode(artifact, { fd, onChunk: (chunk) => inspector.write(chunk), env });
        inspection = inspector.finish();
      } else fail("ARCHIVE_REJECTED");
    } catch (error) { if (error instanceof GuestFailure) throw error; fail("ARCHIVE_REJECTED"); }
    assertStable(fd, details);
    const layout = validateArtifactLayout(artifact, inspection);
    metadataBytes = accountMetadataBytes(metadataBytes, inspection.metadataBytes);
    counts = accountCapacity(counts, layout);
    input.inspection = inspection;
    summaries.push({ ...input.summary, expandedBytes: layout.bytes, members: layout.members, notices: layout.notices });
  }
  return { inputs: summaries, archiveBytes: inputs.archiveBytes, expandedBytes: counts.bytes,
    members: counts.members, metadataBytes, controlReserveBytes: CONTROL_BYTES, controlReserveMembers: CONTROL_MEMBERS };
}

export function parseComponentManifest(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MANIFEST_CAP) fail("INVALID_MANIFEST");
  let text;
  try { text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { fail("INVALID_MANIFEST"); }
  if (!text || text.includes("\r") || text.includes("\uFEFF")) fail("INVALID_MANIFEST");
  const lines = text.endsWith("\n") ? text.slice(0, -1).split("\n") : text.split("\n");
  const seen = new Set();
  return lines.map((line) => {
    const match = /^(file|dir):(.+)$/.exec(line);
    if (!match) fail("INVALID_MANIFEST");
    let path;
    try { path = relativePath(match[2]); }
    catch { fail("INVALID_MANIFEST"); }
    if (seen.has(path)) fail("INVALID_MANIFEST");
    seen.add(path);
    return { type: match[1] === "dir" ? "directory" : "file", path };
  });
}

export function reconcileComponentEntry(prior, entry) {
  if (!entry || !["directory", "file"].includes(entry.type)) fail("INVALID_MANIFEST");
  if (entry.type === "file" && (!Number.isSafeInteger(entry.size) || entry.size < 0 || !SHA.test(entry.sha256))) fail("INVALID_MANIFEST");
  if (!prior) return entry;
  if (prior.type === "directory" && entry.type === "directory") return prior;
  if (prior.type === "file" && entry.type === "file" && prior.size === entry.size && prior.sha256 === entry.sha256) return prior;
  fail("FILE_COLLISION");
}

function resolveInternal(tree, path, boundary) {
  relativePath(path);
  relativePath(boundary);
  const seen = new Set();
  for (let hops = 0; hops <= 64; hops++) {
    if (path !== boundary && !path.startsWith(`${boundary}/`)) fail("UNSAFE_PATH");
    if (seen.has(path)) fail("UNSAFE_PATH");
    seen.add(path);
    const parts = path.split("/");
    let changed = false;
    for (let i = 1; i <= parts.length; i++) {
      const prefix = parts.slice(0, i).join("/");
      const details = tree.stat(prefix);
      if (details.isSymbolicLink()) {
        const target = tree.at(prefix, (selected) => readlinkSync(selected));
        if (!target || isAbsolute(target) || /[\\\x00-\x1f\x7f]/.test(target)) fail("UNSAFE_PATH");
        path = posix.normalize(posix.join(posix.dirname(prefix), target, ...parts.slice(i)));
        changed = true;
        break;
      }
      if (i < parts.length && !details.isDirectory()) fail("UNSAFE_PATH");
    }
    if (!changed) return path;
  }
  fail("UNSAFE_PATH");
}

function identicalComponentFiles(tree, left, right, details) {
  const first = tree.file(left.source);
  let second;
  try {
    second = tree.file(right);
    if (!stable(left.details, fstatSync(first, { bigint: true }))
      || !stable(details, fstatSync(second, { bigint: true }))) fail("FILE_CHANGED");
    if (left.details.dev === details.dev && left.details.ino === details.ino) return true;
    const a = Buffer.alloc(1024 * 1024);
    const b = Buffer.alloc(a.length);
    let position = 0;
    while (position < left.size) {
      const length = Math.min(a.length, left.size - position);
      for (const [fd, buffer] of [[first, a], [second, b]]) {
        let offset = 0;
        while (offset < length) {
          const count = readSync(fd, buffer, offset, length - offset, position + offset);
          if (!count) fail("FILE_CHANGED");
          offset += count;
        }
      }
      if (!a.subarray(0, length).equals(b.subarray(0, length))) return false;
      position += length;
    }
    assertStable(first, left.details);
    assertStable(second, details);
    return true;
  } finally {
    closeSync(first);
    if (second !== undefined) closeSync(second);
  }
}

function componentPlan(tree) {
  const plan = new Map();
  const visited = new Map();
  const hashed = new Map();
  let metadataBytes = 0;
  let planned = { bytes: 0, members: 1 };
  function addDirectory(path, mode = 0o700) {
    relativePath(path);
    const prior = plan.get(path);
    const entry = reconcileComponentEntry(prior, { type: "directory", mode });
    if (!prior) {
      planned = accountCapacity(planned, { bytes: 0, members: 1 });
      plan.set(path, entry);
    }
  }
  function parents(path) {
    const parts = path.split("/");
    for (let i = 1; i < parts.length; i++) addDirectory(parts.slice(0, i).join("/"));
  }
  function visit(source, destination, boundary, ancestors = new Set()) {
    relativePath(destination);
    source = resolveInternal(tree, source, boundary);
    const details = tree.stat(source);
    if (details.uid !== BigInt(process.getuid()) || (details.mode & 0o7022n) !== 0n) fail("UNSAFE_PATH");
    const visitKey = `${boundary}\0${source}\0${destination}`;
    if (visited.has(visitKey)) {
      if (!stable(visited.get(visitKey), details)) fail("FILE_CHANGED");
      return;
    }
    visited.set(visitKey, details);
    parents(destination);
    if (details.isDirectory()) {
      if (ancestors.has(source)) fail("UNSAFE_PATH");
      addDirectory(destination, Number(details.mode & 0o777n));
      const next = new Set([...ancestors, source]);
      for (const name of tree.list(source)) visit(`${source}/${name}`, `${destination}/${name}`, boundary, next);
    } else if (details.isFile()) {
      const prior = plan.get(destination);
      if (prior?.type === "directory") fail("FILE_COLLISION");
      if (!prior) planned = accountCapacity(planned, { bytes: Number(details.size), members: 1 });
      let digest;
      if (hashed.has(source)) {
        const cached = hashed.get(source);
        if (!stable(cached.details, details)) fail("FILE_CHANGED");
        digest = cached.digest;
      } else {
        const fd = tree.file(source);
        try {
          const opened = fstatSync(fd, { bigint: true });
          if (!stable(details, opened)) fail("FILE_CHANGED");
          digest = hashFile(fd, opened);
          hashed.set(source, { details, digest });
        } finally { closeSync(fd); }
      }
      const entry = reconcileComponentEntry(prior, { type: "file", source, details, size: Number(details.size),
        sha256: digest, mode: Number(details.mode & 0o777n) });
      if (prior && !identicalComponentFiles(tree, prior, source, details)) fail("FILE_COLLISION");
      if (!prior) plan.set(destination, entry);
    } else fail("UNSAFE_PATH");
    if (plan.size > completeProfile.limits.members) fail("CAPACITY_EXCEEDED");
  }
  for (const component of COMPONENTS) {
    const boundary = `rust-dist/${component}`;
    const fd = tree.file(`${boundary}/manifest.in`);
    let entries;
    try {
      const details = fstatSync(fd, { bigint: true });
      if (details.uid !== BigInt(process.getuid()) || (details.mode & 0o7022n) !== 0n) fail("INVALID_MANIFEST");
      const bytes = boundedRead(fd, MANIFEST_CAP, details);
      metadataBytes += bytes.length;
      entries = parseComponentManifest(bytes);
    } finally { closeSync(fd); }
    for (const entry of entries) {
      const source = resolveInternal(tree, `${boundary}/${entry.path}`, boundary);
      const details = tree.stat(source);
      if ((entry.type === "directory") !== details.isDirectory() || (entry.type === "file" && !details.isFile())) fail("INVALID_MANIFEST");
      visit(source, entry.path, boundary);
    }
  }
  return { plan, metadataBytes };
}

function assembleRustSysroot(root, currentCounts) {
  const tree = new PrivateTree(root);
  try {
    tree.absent("rust");
    const { plan } = componentPlan(tree);
    let added = { bytes: 0, members: plan.size + 1 };
    for (const entry of plan.values()) if (entry.type === "file") added.bytes += entry.size;
    const counts = accountCapacity(currentCounts, added);
    tree.mkdir("rust");
    const sorted = [...plan].sort(([left], [right]) => left.split("/").length - right.split("/").length || left.localeCompare(right));
    for (const [path, entry] of sorted) {
      const target = `rust/${path}`;
      if (entry.type === "directory") { tree.mkdir(target); continue; }
      const sourceFd = tree.file(entry.source);
      try {
        if (!stable(entry.details, fstatSync(sourceFd, { bigint: true }))) fail("FILE_CHANGED");
        tree.at(target, (selected, parent) => {
          const output = openSync(selected, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
          try {
            const chunk = Buffer.alloc(1024 * 1024);
            const digest = createHash("sha256");
            let offset = 0;
            while (offset < entry.size) {
              const count = readSync(sourceFd, chunk, 0, Math.min(chunk.length, entry.size - offset), offset);
              if (!count) fail("FILE_CHANGED");
              digest.update(chunk.subarray(0, count));
              let written = 0;
              while (written < count) {
                const countWritten = writeSync(output, chunk, written, count - written);
                if (!countWritten) fail("FILE_CHANGED");
                written += countWritten;
              }
              offset += count;
            }
            if (readSync(sourceFd, chunk, 0, 1, offset) !== 0 || digest.digest("hex") !== entry.sha256) fail("FILE_CHANGED");
            assertStable(sourceFd, entry.details);
            fchmodSync(output, entry.mode);
            fsyncSync(output);
            fsyncSync(parent);
          } finally { closeSync(output); }
        });
      } finally { closeSync(sourceFd); }
    }
    tree.assert();
    return { ...counts, copiedBytes: added.bytes, copiedMembers: added.members };
  } finally { tree.close(); }
}

async function materialize(tree, inputs, summary, execute, env) {
  for (const { artifact } of inputs.held) tree.absent(TARGETS[artifact.id]);
  tree.absent("rust");
  for (const input of inputs.held) {
    const { artifact, fd, details, inspection } = input;
    assertStable(fd, details);
    const target = TARGETS[artifact.id];
    tree.mkdir(target);
    if (artifact.id === "bun") {
      const destinations = bunDestinations(inspection.entries, artifact.root);
      const directories = new Set(["bun/bin"]);
      for (const { path, entry } of destinations) {
        if (entry.type === "directory") directories.add(path);
        for (let parent = posix.dirname(path); parent !== "."; parent = posix.dirname(parent)) directories.add(parent);
      }
      for (const path of [...directories].sort((left, right) => left.split("/").length - right.split("/").length)) tree.ensureDirectory(path);
      for (const { path, entry } of destinations) {
        if (entry.type === "file") tree.exclusive(path, entry.content, path === "bun/bin/bun" ? 0o500 : 0o400);
      }
    } else {
      const destinationFd = tree.directory(target);
      try {
        await checkedExecute(execute, ["/usr/bin/tar", "--extract", "--xz", "--file", "/proc/self/fd/3",
          "--directory", "/proc/self/fd/4", "--strip-components=1", "--keep-old-files", "--no-overwrite-dir",
          "--no-same-owner", "--no-same-permissions", "--no-xattrs", "--no-acls", "--no-selinux"],
        { fd, destinationFd, env, milliseconds: 1200000, cap: COMMAND_CAP });
      } finally { closeSync(destinationFd); }
    }
    assertStable(fd, details);
    tree.assert();
  }
  const assembly = assembleRustSysroot(tree.root, { bytes: summary.expandedBytes, members: summary.members });
  return { ...summary, expandedBytes: assembly.bytes, members: assembly.members,
    rustCopiedBytes: assembly.copiedBytes, rustCopiedMembers: assembly.copiedMembers };
}

export function validateVersion(id, stdout) {
  if (typeof stdout !== "string" || Buffer.byteLength(stdout) > COMMAND_CAP || /[\x00-\x08\x0b-\x1f\x7f]/.test(stdout)) fail("INVALID_VERSION");
  let valid = false;
  if (id === "bun") valid = /^1\.4\.0\n$/.test(stdout);
  else if (id === "zig") valid = /^0\.17\.1\n$/.test(stdout);
  else if (id === "cargo") valid = /^cargo 1\.95\.0(?: \([^\n()]+\))?\n$/.test(stdout);
  else if (id === "mise") valid = /^2026\.11\.2(?:\s|$)/.test(stdout);
  else if (id === "clang") valid = /^clang version 23\.1\.5(?:\s|$)/.test(stdout);
  else if (id === "rustc") {
    const lines = stdout.split("\n");
    valid = /^rustc 1\.95\.0(?: \([^\n()]+\))?$/.test(lines[0])
      && lines.filter((line) => line.startsWith("release:")).length === 1
      && lines.includes("release: 1.95.0") && lines.filter((line) => line.startsWith("host:")).length === 1
      && lines.includes(`host: ${HOST}`);
  }
  if (!valid) fail("INVALID_VERSION");
  return true;
}

function scopedContext(root, context) {
  const value = context(root);
  if (!value || value.root !== root || typeof value.path !== "string" || !value.env || typeof value.env !== "object"
    || value.env.PATH !== value.path || value.env.MISE_AUTO_INSTALL !== "false") fail("INVALID_CONTEXT");
  const env = { ...value.env, LANG: "C", LC_ALL: "C" };
  for (const [key, val] of Object.entries(env)) {
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key) || typeof val !== "string" || /[\x00-\x1f\x7f]/.test(val)) fail("INVALID_CONTEXT");
    if ((key === "HOME" || key === "CARGO_HOME" || key === "RUSTUP_HOME" || key.startsWith("XDG_") || /^MISE_.+DIR$/.test(key) || /^ZIG_(GLOBAL|LOCAL)_CACHE_DIR$/.test(key))
      && (!val.startsWith(`${root}/`) || resolve(val) !== val)) fail("INVALID_CONTEXT");
  }
  if (typeof env.HOME !== "string" || !env.HOME.startsWith(`${root}/`)) fail("INVALID_CONTEXT");
  return { root, path: value.path, env };
}

function prepareEnvironment(tree, context) {
  const paths = new Set();
  for (const [key, value] of Object.entries(context.env)) {
    if (key === "HOME" || key === "CARGO_HOME" || key === "RUSTUP_HOME" || key.startsWith("XDG_") || /^MISE_.+DIR$/.test(key) || /^ZIG_(GLOBAL|LOCAL)_CACHE_DIR$/.test(key)) {
      if (!value.startsWith(`${tree.root}/`)) fail("INVALID_CONTEXT");
      paths.add(relativePath(value.slice(tree.root.length + 1)));
    }
  }
  const reserved = ["inputs", ...Object.values(TARGETS), "rust"];
  const created = new Set();
  for (const path of paths) {
    if (reserved.some((name) => path === name || path.startsWith(`${name}/`))) fail("INVALID_CONTEXT");
  }
  for (const path of [...paths].sort((left, right) => left.split("/").length - right.split("/").length)) {
    const parts = path.split("/");
    let prefix = "";
    for (const part of parts) {
      prefix = prefix ? `${prefix}/${part}` : part;
      created.add(prefix);
      if (created.size > CONTROL_MEMBERS - 16) fail("CAPACITY_EXCEEDED");
      try { tree.mkdir(prefix); }
      catch (error) { if (error.code !== "EEXIST") throw error; }
      const details = tree.stat(prefix);
      if (!details.isDirectory() || details.uid !== BigInt(process.getuid()) || (details.mode & 0o7777n) !== 0o700n) fail("INVALID_CONTEXT");
    }
  }
}

function checkedVersionQueries(root) {
  const expectedFor = (root) => [
    { id: "bun", argv: [`${root}/bun/bin/bun`, "--version"], version: "1.4.0" },
    { id: "rustc", argv: [`${root}/rust/bin/rustc`, "-vV"], version: "1.95.0" },
    { id: "cargo", argv: [`${root}/rust/bin/cargo`, "--version"], version: "1.95.0" },
    { id: "zig", argv: [`${root}/zig/zig`, "version"], version: "0.17.1" },
    { id: "mise", argv: [`${root}/mise/bin/mise`, "--version"], version: "2026.11.2" },
    { id: "clang", argv: [`${root}/llvm/bin/clang`, "--version"], version: "23.1.5" },
  ];
  const templateRoot = "/home/agent/workspace/devtools-0000000000000000";
  const expected = expectedFor(templateRoot);
  const queries = versionChecks(templateRoot);
  if (!Array.isArray(queries) || queries.length !== expected.length || expected.some((query) => {
    const matches = queries.filter((other) => other.id === query.id);
    return matches.length !== 1 || matches[0].version !== query.version || JSON.stringify(matches[0].argv) !== JSON.stringify(query.argv);
  })) fail("INVALID_PROFILE");
  return expectedFor(root);
}

export const commandPresenceScript = `set -eu
for name in "$@"; do
  if command -v "$name" >/dev/null 2>&1; then
    printf '%s\tPRESENT\n' "$name"
  else
    printf '%s\tMISSING\n' "$name"
  fi
done
`;

function profileToolNames() {
  if (!Array.isArray(completeProfile.tools) || completeProfile.tools.length !== 15) fail("INVALID_PROFILE");
  const names = completeProfile.tools.map((entry) => typeof entry === "string" ? entry : entry?.command);
  if (names.some((name) => typeof name !== "string" || !/^[a-z][a-z0-9.+-]{0,63}$/.test(name))
    || new Set(names).size !== 15) fail("INVALID_PROFILE");
  return names;
}

export function parseToolPresence(stdout, names) {
  if (typeof stdout !== "string" || stdout !== names.map((name) => `${name}\tPRESENT\n`).join("")) fail("MISSING_TOOLS");
  return names.map((id) => ({ id, status: "PRESENT" }));
}

async function verifyGuestTools(root, { context = guestToolContext, execute = nativeExecute } = {}) {
  const tree = new PrivateTree(root);
  try {
    const scoped = scopedContext(root, context);
    prepareEnvironment(tree, scoped);
    for (const path of [`rust/lib/rustlib/${HOST}/lib`, "llvm/lib/clang/23/include", "zig/lib"]) {
      try {
        const selected = resolveInternal(tree, path, path.split("/")[0]);
        const fd = tree.directory(selected);
        closeSync(fd);
      } catch { fail("MISSING_RESOURCE"); }
    }
    const checkedVersions = [];
    for (const query of checkedVersionQueries(root)) {
      try {
        const path = relativePath(query.argv[0].slice(root.length + 1));
        const selected = resolveInternal(tree, path, path.split("/")[0]);
        const details = tree.stat(selected);
        if (!details.isFile() || details.uid !== BigInt(process.getuid())
          || (details.mode & 0o100n) === 0n || (details.mode & 0o7022n) !== 0n) fail("MISSING_RESOURCE");
      } catch { fail("MISSING_RESOURCE"); }
      const result = await checkedExecute(execute, query.argv,
        { env: scoped.env, milliseconds: 10000, cap: COMMAND_CAP });
      validateVersion(query.id, result.stdout);
      checkedVersions.push({ id: query.id, version: query.version });
    }
    const names = profileToolNames();
    const result = await checkedExecute(execute, ["/bin/sh", "-c", commandPresenceScript, "complete-dev-tools", ...names],
      { env: scoped.env, milliseconds: 10000, cap: COMMAND_CAP });
    const tools = parseToolPresence(result.stdout, names);
    tree.assert();
    return { allToolsAvailable: true, tools, checkedVersions, guestToolRoot: root, guestPath: scoped.path,
      explanation: "NOT_RUN", licensing: "NOT_QUALIFIED" };
  } finally { tree.close(); }
}

export async function runGuestStage(action, options, dependencies = {}) {
  const response = { schema: SCHEMA, action: ACTIONS.includes(action) ? action : null,
    root: null, profileSha256: typeof options?.profileSha256 === "string" && SHA.test(options.profileSha256) ? options.profileSha256 : null,
    result: "STOP", gate0: "OPEN", f9Qualified: false, trainingReady: false };
  let tree, inputs;
  try {
    if (!ACTIONS.includes(action) || !sameKeys(options, ["root", "profileSha256"]) || !SHA.test(options.profileSha256)) fail("INVALID_ARGUMENTS");
    canonical(options.root);
    try {
      if ((dependencies.validateRoot ?? validateGuestToolRoot)(options.root) === false) fail("INVALID_ROOT");
    } catch { fail("INVALID_ROOT"); }
    response.root = options.root;
    if (options.profileSha256 !== completeProfileSha256()) fail("INVALID_PROFILE");
    const artifacts = profileArtifacts();
    tree = new PrivateTree(options.root);
    validateReservation(tree, options.profileSha256);
    validateStageTree(tree, action, options.profileSha256);
    record(tree, action, options.profileSha256, {}, "intent");
    const context = dependencies.context ?? guestToolContext;
    const scoped = scopedContext(options.root, context);
    let data;
    if (action === "verify") {
      data = await verifyGuestTools(options.root, { context, execute: dependencies.execute ?? nativeExecute });
    } else {
      inputs = openInputs(tree, artifacts);
      const summary = await inspectInputs(inputs, dependencies.decode ?? nativeDecode,
        { PATH: "/usr/bin:/bin", HOME: scoped.env.HOME, LANG: "C", LC_ALL: "C" });
      if (action === "inspect") data = summary;
      else {
        const prior = readRecord(tree, "inspect", options.profileSha256);
        if (JSON.stringify(prior.data) !== JSON.stringify(summary)) fail("INVALID_RECEIPT");
        data = await materialize(tree, inputs, summary, dependencies.execute ?? nativeExecute,
          { PATH: "/usr/bin:/bin", HOME: scoped.env.HOME, LANG: "C", LC_ALL: "C" });
      }
    }
    const receipt = record(tree, action, options.profileSha256, data);
    return receipt;
  } catch (error) {
    return { ...response, error: error instanceof GuestFailure && CODES.has(error.code) ? error.code : "GUEST_STAGE_FAILED" };
  } finally {
    if (inputs) for (const input of inputs.held) { try { closeSync(input.fd); } catch {} }
    if (tree) { try { tree.close(); } catch {} }
  }
}

export function parseGuestArguments(argv) {
  if (!Array.isArray(argv) || argv.length !== 5 || !ACTIONS.includes(argv[0])) fail("INVALID_ARGUMENTS");
  const options = {};
  for (let i = 1; i < argv.length; i += 2) {
    const key = { "--root": "root", "--profile-sha": "profileSha256" }[argv[i]];
    if (!key || Object.hasOwn(options, key) || typeof argv[i + 1] !== "string") fail("INVALID_ARGUMENTS");
    options[key] = argv[i + 1];
  }
  if (!sameKeys(options, ["root", "profileSha256"]) || !SHA.test(options.profileSha256)) fail("INVALID_ARGUMENTS");
  canonical(options.root);
  validateGuestToolRoot(options.root);
  return { action: argv[0], options };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let result;
  try {
    const { action, options } = parseGuestArguments(process.argv.slice(2));
    result = await runGuestStage(action, options);
  } catch {
    result = { schema: SCHEMA, action: null, root: null, profileSha256: null, result: "STOP",
      gate0: "OPEN", f9Qualified: false, trainingReady: false, error: "INVALID_ARGUMENTS" };
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.result === "PASS" ? 0 : 2;
}
